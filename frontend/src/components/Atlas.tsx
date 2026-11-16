import { useEffect, useMemo, useState, type ReactNode } from 'react'
import L from 'leaflet'
import { Circle, MapContainer, Marker, Polyline, ScaleControl, Tooltip, useMap, ZoomControl } from 'react-leaflet'
import { Expand, RotateCcw, X, Navigation2 } from 'lucide-react'
import type { Clusters, Ubicacion } from '../types/api'
import BaseMapa from './BaseMapa'
import Ejes from './Ejes'
import { colorZona } from '../services/colores'
import { metros } from '../services/formato'
import { candidataPreliminar } from '../services/analisis'
import Modal from './Modal'

type Coordenadas = { latitude: number; longitude: number }
const posicion = (p: Coordenadas): L.LatLngTuple => [p.latitude, p.longitude]
type Simbolo = 'negocio' | 'centro' | 'propuesta' | 'vecino' | 'excluido' | 'pendiente'

export function simbolo(tipo: Simbolo, zona?: string | null, texto = '', especial = false) {
  const nodo = document.createElement('span')
  nodo.className = ['punto', tipo, zona === 'Zona 2' ? 'segunda' : '', especial ? 'especial' : ''].join(' ')
  nodo.style.setProperty('--zona', colorZona(zona))
  nodo.textContent = texto
  const lado = tipo === 'propuesta' ? 32 : tipo === 'vecino' || tipo === 'centro' ? 22 : 13
  return L.divIcon({ className: 'icono-atlas', html: nodo, iconSize: [lado, lado], iconAnchor: [lado / 2, lado / 2] })
}

export function AjustarMapa({ encuadrar, revision = 0 }: { encuadrar?: (mapa: L.Map) => void; revision?: number }) {
  const mapa = useMap()
  useEffect(() => {
    let frame = 0
    const obs = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => { mapa.invalidateSize({pan: false}) })
    })
    obs.observe(mapa.getContainer())
    return () => { obs.disconnect(); cancelAnimationFrame(frame) }
  }, [mapa])
  useEffect(() => { encuadrar?.(mapa) }, [mapa, encuadrar, revision])
  return null
}

function Marco({ titulo, children }: {titulo: string; children: (amplio: boolean) => ReactNode}) {
  const [amplio, setAmplio] = useState(false)
  return <div className="marco-atlas">
    <button className="boton expandir" onClick={() => setAmplio(true)} aria-label={'Ampliar ' + titulo}><Expand size={15}/> Ampliar</button>
    {children(false)}
    {amplio && <Modal titulo={titulo} cerrar={() => setAmplio(false)} clase="visor">
      <header><h2>{titulo}</h2><button className="boton" onClick={() => setAmplio(false)}><X size={16}/> Cerrar</button></header>
      {children(true)}
    </Modal>}
  </div>
}

type AtlasProps = {
  clusters: Clusters; ubicaciones: Ubicacion[]; oscuro?: boolean; seleccion?: string;
  alElegir?: (id: string) => void; titulo?: string
}

export function Atlas(props: AtlasProps) {
  const titulo = props.titulo ?? 'Concesionarios agrupados'
  return <Marco titulo={titulo}>{amplio => <Plano {...props} amplio={amplio}/>}</Marco>
}

function Plano({ clusters, ubicaciones, oscuro, seleccion, alElegir, amplio }: AtlasProps & {amplio: boolean}) {
  const [ocultas, setOcultas] = useState<string[]>([])
  const [revision, setRevision] = useState(0)
  const [detalle, setDetalle] = useState('')
  const candidata = candidataPreliminar(ubicaciones)?.id
  const visible = (c: string) => !ocultas.includes(c)
  const fit = useMemo(() => {
    const puntos = [...clusters.grupos.flatMap(g => g.miembros), ...ubicaciones, ...clusters.grupos].map(posicion)
    return (m: L.Map) => { if (puntos.length) m.fitBounds(L.latLngBounds(puntos), {padding:[35, 35], animate:false, maxZoom:16}) }
  }, [clusters, ubicaciones])
  function alternar(c: string) { setDetalle(''); setOcultas(lista => lista.includes(c) ? lista.filter(v => v !== c) : [...lista, c]) }
  return <div className={'atlas ' + (oscuro ? 'oscuro ' : '') + (amplio ? 'amplio' : '')}>
    <MapContainer center={[13.698,-89.222]} zoom={13} zoomSnap={.25} maxZoom={20} minZoom={5} zoomControl={false} attributionControl={Boolean(oscuro)}
      scrollWheelZoom={!oscuro || amplio} preferCanvas className="lienzo">
      <AjustarMapa encuadrar={fit} revision={revision}/><ZoomControl position="bottomright"/>{oscuro && <ScaleControl imperial={false}/>} 
      {oscuro ? <BaseMapa/> : <Ejes/>}
      {clusters.grupos.filter(g => visible(g.zona)).map(g => g.miembros.map(p => {
        const nombre = p.name || 'Sin nombre'
        const info = nombre + ' · ' + g.zona + ' · ' + p.latitude.toFixed(5) + ', ' + p.longitude.toFixed(5)
        return <Marker key={p.osm_id} position={posicion(p)} title={info} alt={info} icon={simbolo('negocio', g.zona)}
          eventHandlers={{click:() => setDetalle(info)}}><Tooltip>{nombre}<br/>{g.zona} · {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</Tooltip></Marker>
      }))}
      {visible('Centroides') && clusters.grupos.filter(g => visible(g.zona)).map(g => <Marker key={g.zona} position={posicion(g)}
        title={'Centroide de ' + g.zona} icon={simbolo('centro',g.zona)} eventHandlers={{click:() => setDetalle('Centroide de ' + g.zona + ' · ' + g.count + ' concesionarios · ' + g.latitude.toFixed(5) + ', ' + g.longitude.toFixed(5))}}>
        <Tooltip permanent={oscuro} direction="right" offset={[7,0]} className={oscuro ? 'rotulo-zona' : ''}>{oscuro ? g.zona : <>Centroide de {g.zona}<br/>{g.latitude.toFixed(5)}, {g.longitude.toFixed(5)}</>}</Tooltip></Marker>)}
      {visible('Propuestas') && ubicaciones.map(u => <Marker key={u.id} position={posicion(u)} icon={simbolo('propuesta',u.zona_knn,u.id,u.id === candidata)}
        zIndexOffset={u.id === seleccion ? 600 : 500} title={'Ubicación ' + u.id} eventHandlers={{click:() => { alElegir?.(u.id); setDetalle('Ubicación ' + u.id + ' · ' + u.zona_knn + ' · ' + u.latitude.toFixed(5) + ', ' + u.longitude.toFixed(5)) }}}>
        <Tooltip>Ubicación {u.id} · {u.zona_knn}<br/>{u.latitude.toFixed(5)}, {u.longitude.toFixed(5)}</Tooltip></Marker>)}
    </MapContainer>
    <div className="norte" aria-label="Norte"><Navigation2 size={14}/> N</div>
    {!oscuro && <p className="leyenda-ejes">X · Longitud (°) <span>Y · Latitud (°)</span></p>}
    <div className="leyenda-atlas" aria-label="Capas del gráfico">{[...clusters.grupos.map(g => g.zona), 'Centroides','Propuestas'].map(c =>
      <button key={c} aria-pressed={visible(c)} onClick={() => alternar(c)}>
        <i className={c === 'Centroides' ? 'diana' : c === 'Propuestas' ? 'abc' : c === 'Zona 2' ? 'anillo' : ''} style={{'--zona':colorZona(c)} as React.CSSProperties}/>{c}</button>)}
      <button className="reset" onClick={() => setRevision(revision + 1)} title="Restablecer zoom" aria-label="Restablecer zoom"><RotateCcw size={15}/></button>
    </div>
    {detalle && <p className="detalle-atlas" role="status">{detalle}</p>}
  </div>
}

export function Vecindarios({ ubicaciones }: {ubicaciones: Ubicacion[]}) {
  const radio = Math.max(100, ...ubicaciones.flatMap(u => u.vecinos_knn.map(v => v.distance_m))) * 1.14
  return <div className="vecindarios">{ubicaciones.map(u => <section key={u.id} className="tarjeta vecino-card">
    <h3>Ubicación {u.id} <span>{u.zona_knn}</span></h3><Marco titulo={'Vecinos de ' + u.id}>
      {amplio => <Vecindario u={u} radio={radio} amplio={amplio}/>}</Marco></section>)}</div>
}

function Vecindario({ u, radio, amplio }: {u: Ubicacion; radio: number; amplio: boolean}) {
  const [activo, setActivo] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [revision,setRevision] = useState(0)
  const destacado = sobre ?? activo
  const fit = useMemo(() => (mapa: L.Map) => {
    mapa.fitBounds(L.latLng(posicion(u)).toBounds(radio*2), {padding:[14,14],animate:false})
  }, [u, radio])
  return <div className={'atlas knn ' + (amplio ? 'amplio' : '')}>
    <MapContainer className="lienzo" center={posicion(u)} zoom={15} maxZoom={20} minZoom={5} zoomControl={false} attributionControl={false} zoomSnap={.05}>
      <AjustarMapa encuadrar={fit} revision={revision}/><ZoomControl position="bottomright"/><Ejes origen={u}/>
      {[250,500,1000].filter(r => r <= radio).map(r => <Circle key={r} center={posicion(u)} radius={r} interactive={false}
        pathOptions={{color:'#94a4a9',weight:1,dashArray:'3 5',fill:false}}/>)}
      {u.vecinos_knn.map((v,i) => {
        if (v.latitude == null || v.longitude == null) return null
        const pos: L.LatLngTuple = [v.latitude,v.longitude]
        return <Polyline key={v.osm_id} positions={[posicion(u),pos]} interactive={false}
          pathOptions={{color:colorZona(v.zona),weight:destacado === v.osm_id ? 4 : 1.5,opacity:destacado && destacado !== v.osm_id ? .32 : .95}}>
          <Marker position={pos} icon={simbolo('vecino',v.zona,String(i+1),destacado === v.osm_id)} title={v.name}
            eventHandlers={{mouseover:() => setSobre(v.osm_id),mouseout:() => setSobre(null),click:() => setActivo(v.osm_id)}}>
            <Tooltip>{v.name} · {v.zona}<br/>{metros(v.distance_m)} de {u.id}</Tooltip></Marker>
        </Polyline>
      })}
      <Marker position={posicion(u)} icon={simbolo('propuesta',u.zona_knn,u.id)} title={'Ubicación ' + u.id}><Tooltip>Ubicación {u.id} · {u.zona_knn}</Tooltip></Marker>
    </MapContainer>
    <div className="norte"><Navigation2 size={13}/> N</div>
    <p className="leyenda-ejes">X · Este (m) <span>Y · Norte (m)</span></p>
    <div className="knn-leyenda"><span>{[...new Set(u.vecinos_knn.map(v => v.zona))].map(z => <b key={z} style={{color:colorZona(z)}}>{z} </b>)} · Línea recta</span>
      <button onClick={() => setRevision(revision+1)} title="Restablecer zoom" aria-label="Restablecer zoom"><RotateCcw size={15}/></button></div>
    <ol className="lista-vecinos">{u.vecinos_knn.map((v,i) => <li key={v.osm_id}><button aria-pressed={activo === v.osm_id} className={destacado === v.osm_id ? 'elegido' : ''}
      onClick={() => setActivo(v.osm_id)} onFocus={() => setSobre(v.osm_id)} onBlur={() => setSobre(null)} onMouseEnter={() => setSobre(v.osm_id)} onMouseLeave={() => setSobre(null)}>
      <b style={{background:colorZona(v.zona)}}>{i+1}</b><span>{v.name}<small>{v.zona}</small></span><strong>{metros(v.distance_m)}</strong>
    </button></li>)}</ol>
  </div>
}
