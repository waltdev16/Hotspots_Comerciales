import BaseMapa from '../components/BaseMapa'
import { simbolo, AjustarMapa } from '../components/Atlas'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { GeoJSON, MapContainer, Marker, Polyline, Tooltip, ZoomControl, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { FeatureCollection } from 'geojson'
import { Crosshair, Layers, Loader2, MousePointerClick } from 'lucide-react'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import type { Centroide, Concesionario, PuntoNuevo, Ubicacion, Vecino } from '../types/api'
import PanelUbicacion from '../components/PanelUbicacion'
import { Cargando, ErrorCarga } from '../components/ui'
import { Muestra } from '../components/narrativa'
import { colorZona } from '../services/colores'
import { candidataPreliminar } from '../services/analisis'
import { metros } from '../services/formato'

const CENTRO: [number, number] = [13.698, -89.222]

type Capas = { limite: boolean; distritos: boolean; concesionarios: boolean; centroides: boolean;
  ubicaciones: boolean; vecinos: boolean; pendientes: boolean; excluidos: boolean; red: boolean; area: boolean }
type Vista = 'ubicaciones' | 'Zona 1' | 'Zona 2' | 'registros'

const CAPAS_ZONA: Capas = { limite: true, distritos: false, concesionarios: true, centroides: true, ubicaciones: true, vecinos: false, pendientes: false, excluidos: false, red: false, area: false }
const VISTAS: Record<Vista, { texto: string; capas: Capas; lectura: string }> = {
  ubicaciones: {
    texto: 'Todas las ubicaciones',
    capas: { limite: true, distritos: false, concesionarios: true, centroides: true, ubicaciones: true, vecinos: true, pendientes: false, excluidos: false, red: false, area: true },
    lectura: 'A, B y C unidas a sus tres vecinos más cercanos (KNN). Los puntos sólidos pertenecen a la Zona 1 y los anillados a la Zona 2.',
  },
  'Zona 1': {
    texto: 'Zona 1', capas: CAPAS_ZONA,
    lectura: 'Solo los concesionarios que K-Means asignó a la Zona 1 y su centroide (diana).',
  },
  'Zona 2': {
    texto: 'Zona 2', capas: CAPAS_ZONA,
    lectura: 'Solo los concesionarios que K-Means asignó a la Zona 2 y su centroide (diana).',
  },
  registros: {
    texto: 'Todos los registros',
    capas: { limite: true, distritos: true, concesionarios: true, centroides: false, ubicaciones: false, vecinos: false, pendientes: true, excluidos: true, red: false, area: false },
    lectura: 'Todos los establecimientos de OpenStreetMap: los rellenos se usaron en el análisis; los huecos están pendientes de revisión y los cuadros quedaron fuera.',
  },
}

const ETIQUETAS_CAPAS: [keyof Capas, string][] = [
  ['limite', 'Límite del distrito de San Salvador'],
  ['distritos', 'Otros distritos OPAMSS'],
  ['concesionarios', 'Concesionarios por zona'],
  ['centroides', 'Centroides K-Means'],
  ['ubicaciones', 'Ubicaciones A, B y C'],
  ['vecinos', 'Vecinos KNN de A, B y C'],
  ['pendientes', 'Pendientes de revisión'],
  ['excluidos', 'Excluidos y fuera del núcleo'],
  ['area', 'Área de estudio KNN'],
  ['red', 'Red vial OSM'],
]

function ClicMapa({ activo, onClic }: { activo: boolean; onClic: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => { if (activo) onClic(e.latlng.lat, e.latlng.lng) } })
  return null
}

function LineasVecinos({ lat, lon, vecinos, opacidad = 0.9 }: { lat: number; lon: number; vecinos: Vecino[]; opacidad?: number }) {
  return (
    <>
      {vecinos.filter((v) => v.latitude !== undefined).map((v) => (
        <Polyline key={v.osm_id} positions={[[lat, lon], [v.latitude!, v.longitude!]]} interactive={false}
          pathOptions={{ color: colorZona(v.zona), weight: 1.5, dashArray: '4 4', opacity: opacidad }} />
      ))}
    </>
  )
}

const pastilla = (activa: boolean) =>
  `rounded-full px-[14px] py-[7px] text-xs font-medium transition-colors ${activa ? 'bg-texto text-white' : 'bg-[#d9d9d9] text-texto hover:bg-[#cdcdcd]'}`

export default function Mapa() {
  const [params, setParams] = useSearchParams()
  const ubicaciones = useApi(api.ubicaciones)
  const establecimientos = useApi(api.concesionarios)
  const clusters = useApi(api.clusters)
  const [limites, setLimites] = useState<FeatureCollection | null>(null)
  const [area, setArea] = useState<FeatureCollection | null>(null)
  const [red, setRed] = useState<FeatureCollection | null>(null)
  const [vista, setVista] = useState<Vista | null>('ubicaciones')
  const [capas, setCapas] = useState<Capas>(VISTAS.ubicaciones.capas)
  const [mapa, setMapa] = useState<L.Map | null>(null)
  const [ficha, setFicha] = useState<Concesionario | Centroide | null>(null)
  const [minimizado, setMinimizado] = useState(false)
  const [detallado, setDetallado] = useState(params.has('ubicacion'))
  const [errorCapa, setErrorCapa] = useState('')
  const [verCapas, setVerCapas] = useState(false)
  const [seleccionando, setSeleccionando] = useState(false)
  const [nuevo, setNuevo] = useState<PuntoNuevo | null>(null)
  const [analizando, setAnalizando] = useState(false)
  const [errorPunto, setErrorPunto] = useState<string | null>(null)
  const [formLat, setFormLat] = useState('')
  const [formLon, setFormLon] = useState('')
  const seleccion = params.get('ubicacion')

  useEffect(() => {
    api.geo('limites').then(setLimites).catch(() => setErrorCapa('No se pudieron cargar los límites distritales.'))
    api.geo('area-estudio').then(setArea).catch(() => setErrorCapa('No se pudo cargar el área de estudio.'))
  }, [])
  useEffect(() => {
    if (capas.red && !red) api.geo('red-vial').then(setRed).catch(() => setErrorCapa('No se pudo cargar la red vial.'))
  }, [capas.red, red])

  const candidata = useMemo(() => candidataPreliminar(ubicaciones.datos ?? []), [ubicaciones.datos])
  const ubicacionActiva = ubicaciones.datos?.find((u) => u.id === seleccion) ?? null
  const resumida = ubicacionActiva ?? ubicaciones.datos?.find((u) => u.id === candidata?.id) ?? null
  const filtroZona = vista === 'Zona 1' || vista === 'Zona 2' ? vista : null
  const centroides: Centroide[] = (clusters.datos?.grupos ?? []).filter((g) => !filtroZona || g.zona === filtroZona)
  const lista: Concesionario[] = establecimientos.datos?.registros ?? []
  const entrenamiento = useMemo(() => lista.filter((c) => c.usado_entrenamiento && (!filtroZona || c.zona === filtroZona)), [lista, filtroZona])
  const pendientes = useMemo(() => lista.filter((c) => c.estado === 'pendiente_revision'), [lista])
  const excluidos = useMemo(() => lista.filter((c) => !c.usado_entrenamiento && c.estado !== 'pendiente_revision'), [lista])
  const limiteSS = useMemo(() => limites && ({ ...limites, features: limites.features.filter((f) => f.properties?.es_san_salvador) }), [limites])
  const otros = useMemo(() => limites && ({ ...limites, features: limites.features.filter((f) => !f.properties?.es_san_salvador) }), [limites])

  function elegirVista(v: Vista) {
    setVista(v)
    setFicha(null)
    setCapas(VISTAS[v].capas)
  }
  function alternarCapa(clave: keyof Capas) {
    setCapas({ ...capas, [clave]: !capas[clave] })
    if (!filtroZona) setVista(null)
  }

  async function analizar(lat: number, lon: number) {
    setSeleccionando(false)
    setAnalizando(true)
    setErrorPunto(null)
    setParams({})
    setFicha(null); setMinimizado(false); setDetallado(true)
    try {
      setNuevo(await api.analizar(lat, lon, 'Nueva ubicación'))
    } catch (e) {
      setNuevo(null)
      setErrorPunto((e as Error).message)
    } finally {
      setAnalizando(false)
    }
  }

  function enviarFormulario(ev: React.FormEvent) {
    ev.preventDefault()
    const lat = Number(formLat.replace(',', '.'))
    const lon = Number(formLon.replace(',', '.'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      setErrorPunto('Escriba una latitud entre −90 y 90 y una longitud entre −180 y 180.')
      return
    }
    analizar(lat, lon)
  }

  const errorGeneral = ubicaciones.error ?? establecimientos.error ?? clusters.error
  const lectura = vista && capas === VISTAS[vista].capas ? VISTAS[vista].lectura : 'Vista personalizada. Las capas activas se muestran en la leyenda.'

  function elegir(id: string) {
    setParams({ubicacion: id}); setNuevo(null); setFicha(null); setDetallado(false); setMinimizado(false)
  }
  function abrir(p: Concesionario | Centroide) {
    if (!seleccionando) { setFicha(p); setMinimizado(false) }
  }
  function ajustarTodos() {
    const puntos = [...lista,...(ubicaciones.datos ?? []),...(clusters.datos?.grupos ?? []),...(nuevo ? [nuevo] : [])]
    if (puntos.length) mapa?.fitBounds(L.latLngBounds(puntos.map(p => [p.latitude,p.longitude])), {padding:[32,32],animate:false})
  }
  function distancia(c: Concesionario) {
    const ref = nuevo ?? resumida
    const v = ref?.vecinos_knn.find(v => v.osm_id === c.osm_id)
    const ruta = ref?.rutas_cercanas.find(v => v.osm_id === c.osm_id)
    return v?.distance_m ?? ruta?.distancia_recta_m
  }
  const marcador = (c: Concesionario, tipo: 'negocio' | 'pendiente' | 'excluido') =>
    <Marker key={c.osm_id} position={[c.latitude,c.longitude]} icon={simbolo(tipo,c.zona)} title={c.name ?? 'Sin nombre'}
      alt={c.name ?? 'Sin nombre'} eventHandlers={{click:() => abrir(c)}}>
      <Tooltip><strong>{c.name ?? 'Sin nombre'}</strong><br/>{c.detalle_dataset} · {c.zona ?? 'Sin zona'}
        {distancia(c) != null && <><br/>{metros(distancia(c))} de {nuevo ? 'la nueva ubicación' : resumida?.id} en línea recta</>}
        {c.motivo && <><br/>{c.motivo}</>}</Tooltip>
    </Marker>

  return (
    <>
      <header className="cabecera-inicio"><p className="etiqueta"><i/> Exploración geográfica</p>
        <h1>Explorar ubicaciones</h1><p>Selecciona una propuesta, un concesionario o un centroide para consultar sus datos.</p></header>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Vista del mapa" className="flex flex-wrap gap-3">
          {(Object.keys(VISTAS) as Vista[]).map((v) => (
            <button key={v} role="radio" aria-checked={vista === v} onClick={() => elegirVista(v)} className={pastilla(vista === v)}>
              {VISTAS[v].texto}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button disabled={analizando} onClick={() => { setSeleccionando(!seleccionando); setErrorPunto(null) }}
            className={`inline-flex items-center gap-2 rounded-full px-[14px] py-[7px] text-xs font-medium ${
              seleccionando ? 'bg-texto text-white' : 'border border-linea bg-superficie text-texto hover:bg-superficie-2'}`}>
            {analizando ? <Loader2 className="size-3.5 animate-spin" /> : <MousePointerClick className="size-3.5" />}
            {seleccionando ? 'Haga clic en el mapa' : 'Analizar nueva ubicación'}
          </button>
          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-linea bg-superficie px-[14px] py-[7px] text-xs font-medium hover:bg-superficie-2">
              <Crosshair className="size-3.5" /> Coordenadas
            </summary>
            <form onSubmit={enviarFormulario} className="absolute right-0 z-[1100] mt-2 flex flex-wrap items-end gap-2 rounded-[13px] border border-linea bg-superficie p-3 shadow-lg">
              <label className="text-xs text-tenue">Latitud
                <input value={formLat} onChange={(e) => setFormLat(e.target.value)} inputMode="decimal" placeholder="13.700"
                  className="mt-1 block w-28 rounded-md border border-linea bg-fondo px-2 py-1.5 text-sm text-texto" required />
              </label>
              <label className="text-xs text-tenue">Longitud
                <input value={formLon} onChange={(e) => setFormLon(e.target.value)} inputMode="decimal" placeholder="-89.220"
                  className="mt-1 block w-28 rounded-md border border-linea bg-fondo px-2 py-1.5 text-sm text-texto" required />
              </label>
              <button type="submit" disabled={analizando} className="rounded-md bg-texto px-3 py-1.5 text-sm text-white">Analizar</button>
            </form>
          </details>
        </div>
      </div>
      {(errorPunto || errorGeneral) && (
        <div className="mt-3 max-w-xl">
          <ErrorCarga mensaje={errorPunto ?? errorGeneral ?? ''} reintentar={errorPunto ? undefined : () => {
            ubicaciones.reintentar(); establecimientos.reintentar(); clusters.reintentar()
          }} />
        </div>
      )}

      {errorCapa && <p role="status" className="nota-radio">{errorCapa}</p>}
      {ubicaciones.cargando && <Cargando/>}
      <div className="herramientas-mapa"><button className="boton" onClick={() => { elegirVista('ubicaciones'); mapa?.setView(CENTRO,13,{animate:false}) }}>Restablecer vista</button>
        <button className="boton" onClick={ajustarTodos}>Ajustar a todos los puntos</button>
        <button className="boton" aria-expanded={verCapas} onClick={() => setVerCapas(!verCapas)}><Layers size={15}/> Capas y leyenda</button></div>
      {verCapas && <div className="capas">{ETIQUETAS_CAPAS.map(([clave,texto]) => <label key={clave}><input type="checkbox" checked={capas[clave]} onChange={() => alternarCapa(clave)}/> {texto}</label>)}</div>}
      <div className={'explorador ' + (minimizado ? 'sin-panel ' : '') + (seleccionando ? 'modo-seleccion' : '')}>
        <div className="mapa-principal"><MapContainer minZoom={5} maxZoom={20} ref={setMapa} center={CENTRO} zoom={13} className="h-full w-full" zoomControl={false}>
          <AjustarMapa/><ZoomControl position="bottomright" />
          <BaseMapa/>
          <ClicMapa activo={seleccionando} onClic={analizar} />

          {capas.distritos && otros && (
            <GeoJSON key="otros" data={otros} interactive
              style={{ color: '#969c94', weight: 1, fillOpacity: 0, dashArray: '3 4' }}
              onEachFeature={(f, capa) => capa.bindTooltip(`${f.properties?.nombre} (${f.properties?.municipio})`, { sticky: true })} />
          )}
          {capas.limite && limiteSS && (
            <GeoJSON key="ss" data={limiteSS} interactive={false}
              style={{ color: '#333639', weight: 1.5, fillColor: '#333639', fillOpacity: 0.03 }} />
          )}
          {capas.area && area && (
            <GeoJSON key="area" data={area} interactive={false} style={{ color: '#6d7178', weight: 1, dashArray: '6 6', fillOpacity: 0 }} />
          )}
          {capas.red && red && <GeoJSON key="red" data={red} interactive={false} style={{ color: capas.red ? '#537784' : '#b6bdba', weight: capas.red ? 1.8 : 1, opacity: capas.red ? .95 : .75 }} />}

          {capas.excluidos && excluidos.map(c => marcador(c,'excluido'))}
          {capas.pendientes && pendientes.map(c => marcador(c,'pendiente'))}
          {capas.vecinos && !ubicacionActiva && !nuevo && ubicaciones.datos?.map((u) => (
            <LineasVecinos key={u.id} lat={u.latitude} lon={u.longitude} vecinos={u.vecinos_knn} opacidad={0.75} />
          ))}
          {capas.vecinos && ubicacionActiva && <LineasVecinos lat={ubicacionActiva.latitude} lon={ubicacionActiva.longitude} vecinos={ubicacionActiva.vecinos_knn} />}
          {capas.vecinos && nuevo && <LineasVecinos lat={nuevo.latitude} lon={nuevo.longitude} vecinos={nuevo.vecinos_knn} />}
          {capas.concesionarios && entrenamiento.map(c => marcador(c,'negocio'))}
          {capas.centroides && centroides.map((c) => (
            <Marker key={c.zona} position={[c.latitude, c.longitude]} icon={simbolo('centro',c.zona)} title={'Centroide de ' + c.zona} eventHandlers={{click:() => abrir(c)}}>
              <Tooltip><b>Centroide de {c.zona}</b><br />{c.count} concesionarios</Tooltip>
            </Marker>
          ))}
          {capas.ubicaciones && ubicaciones.datos?.map((u: Ubicacion) => (
            <Marker key={u.id} position={[u.latitude, u.longitude]} title={'Ubicación ' + u.id} icon={simbolo('propuesta',u.zona_knn,u.id,u.id === candidata?.id)} zIndexOffset={1000}
              eventHandlers={{ click: () => { if (!seleccionando) { elegir(u.id) } } }}>
              <Tooltip direction="top" offset={[0, -16]}><b>Ubicación {u.id}</b><br />{u.zona_knn}. Clic para ver el detalle</Tooltip>
            </Marker>
          ))}
          {nuevo && (
            <Marker position={[nuevo.latitude, nuevo.longitude]} title="Nueva ubicación" eventHandlers={{click:() => {setFicha(null); setMinimizado(false); setDetallado(true)}}} icon={simbolo('propuesta',nuevo.zona_knn,'+')} zIndexOffset={1000}>
              <Tooltip direction="top" offset={[0, -14]}>Nueva ubicación</Tooltip>
            </Marker>
          )}
        </MapContainer>

        </div>
        {!minimizado && <aside className="tarjeta inspector">
          <div className="titulo-bloque"><p className="etiqueta">Detalle del mapa</p><button className="boton" onClick={() => setMinimizado(true)}>Minimizar</button></div>
          <div className="segmentos">{ubicaciones.datos?.map(u => <button key={u.id} aria-pressed={!nuevo && resumida?.id === u.id} onClick={() => elegir(u.id)}>Ver {u.id}</button>)}</div>
          {ficha ? <><h2>{'osm_id' in ficha ? ficha.name ?? 'Sin nombre' : 'Centroide de ' + ficha.zona}</h2>
            <dl className="ficha">{('osm_id' in ficha ? [
              ['Tipo',ficha.detalle_dataset], ['Grupo',ficha.zona], ['Categoría',ficha.category], ['Marca',ficha.brand], ['Calle',ficha.street], ['Usado en el modelo',ficha.usado_entrenamiento ? 'Sí' : 'No'],
              ['Estado',ficha.estado.replaceAll('_',' ')], ['Motivo',ficha.motivo], ['Fuente',ficha.fuente_verificacion], ['OSM',ficha.osm_id],
              ['Distancia a ' + (nuevo ? 'la nueva ubicación' : resumida?.id),distancia(ficha) != null ? metros(distancia(ficha)) + ' en línea recta' : null],
              ] : [['Tipo','Centro calculado por K-Means'],['Concesionarios',ficha.count],['Radio medio',metros(ficha.radio_medio_m)],['Radio máximo',metros(ficha.radio_max_m)]]).concat([['Coordenadas',ficha.latitude.toFixed(5) + ', ' + ficha.longitude.toFixed(5)]]).map(([k,v]) => v != null && <div key={String(k)}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <button className="boton" onClick={() => setFicha(null)}>Volver a la ubicación</button>
          </> : (nuevo || (detallado && resumida)) ? <PanelUbicacion key={nuevo ? 'nuevo' : resumida?.id} punto={(nuevo ?? resumida)!}
            titulo={nuevo ? 'Nueva ubicación' : 'Ubicación ' + resumida?.id}
            avisos={nuevo?.avisos} onCerrar={() => {setDetallado(false); setNuevo(null)}}/>
          : resumida && <><h2>Ubicación {resumida.id}</h2><p>{resumida.zona_knn} · {resumida.id === candidata?.id ? 'Candidata preliminar' : 'Propuesta'}</p>
            <dl className="ficha"><div><dt>A 1 km en línea recta</dt><dd>{resumida.concesionarios_1km}</dd></div><div><dt>A 2 km en línea recta</dt><dd>{resumida.concesionarios_2km}</dd></div>
            <div><dt>Competidor más cercano</dt><dd>{metros(resumida.distancia_mas_cercano_m)}</dd></div></dl><button className="boton" onClick={() => setDetallado(true)}>Ver detalle completo</button></>}
        </aside>}
      </div>
      {minimizado && <button className="boton mt-2" onClick={() => setMinimizado(false)}>Mostrar detalle</button>}
      <div className="leyenda-simple">{(clusters.datos?.grupos ?? []).map(g => <button key={g.zona} onClick={() => elegirVista(vista === g.zona ? 'ubicaciones' : g.zona as Vista)} aria-pressed={vista === g.zona}>
        <Muestra color={colorZona(g.zona)} forma={g.zona === 'Zona 2' ? 'anillo' : 'circulo'}/> {g.zona}</button>)}
        <button onClick={() => alternarCapa('centroides')} aria-pressed={capas.centroides}>◎ Centroides</button>
        <button onClick={() => alternarCapa('ubicaciones')} aria-pressed={capas.ubicaciones}>Ⓐ Propuestas</button>
        <button onClick={() => alternarCapa('concesionarios')} aria-pressed={capas.concesionarios}>● Competidores</button></div>
      <p className="text-sm text-tenue">{lectura}</p>
    </>
  )
}
