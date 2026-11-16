import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { Cargando, ErrorCarga } from '../components/ui'
import { Destacados, Etiqueta, PASOS, Panel, PorQue, Seccion } from '../components/narrativa'
import { Atlas } from '../components/Atlas'
import { Metricas, Hallazgo } from '../components/Metricas'
import { candidataPreliminar, competidorMasProximo } from '../services/analisis'
import { decimal, entero, fecha, metros } from '../services/formato'

const dos = (n: number) => String(n).padStart(2, '0')

export default function Inicio() {
  const resumen = useApi(api.resumen)
  const ubic = useApi(api.ubicaciones)
  const [id,setId] = useState('')
  const clusters = useApi(api.clusters)
  const estado = useApi(api.estado)

  if (resumen.cargando || ubic.cargando) return <Cargando />
  if (resumen.error || !resumen.datos) return <ErrorCarga mensaje={resumen.error ?? 'Sin datos'} reintentar={resumen.reintentar} />
  if (ubic.error || !ubic.datos) return <ErrorCarga mensaje={ubic.error ?? 'Sin datos'} reintentar={ubic.reintentar} />
  const r = resumen.datos
  const u = ubic.datos
  const e = estado.datos
  const candidata = candidataPreliminar(u)
  const uc = u.find((x) => x.id === candidata?.id)
  if (!u.length) return <p>No hay ubicaciones propuestas disponibles.</p>
  const proximo = competidorMasProximo(u)
  const densa = [...u].sort((a, b) => a.distancia_tercer_vecino_m - b.distancia_tercer_vecino_m)[0]
  const mejorSil = clusters.datos ? [...clusters.datos.evaluacion_kmeans].sort((a, b) => b.silhouette - a.silhouette)[0] : null
  const seleccion = u.find(x => x.id === id) ?? uc ?? u[0]

  return (
    <>
      <header className="cabecera-inicio">
        <p className="etiqueta"><i/> Hotspots comerciales</p>
        <h1>Análisis de ubicaciones comerciales</h1>
        <p>Evaluación geoespacial de oportunidades para un nuevo concesionario Porsche en San Salvador.</p>
      </header>
      <Metricas resumen={r} ubicaciones={u} seleccion={seleccion}/>
      <div className="resumen-grid">
        <section className="tarjeta mapa-resumen">
          <div className="titulo-bloque"><div><p className="etiqueta">Distribución geográfica</p><h2>Mapa de ubicaciones</h2></div>
            <Link className="enlace-mapa" to={'/mapa?ubicacion=' + (seleccion?.id ?? '')}>Explorar mapa <ArrowUpRight size={15}/></Link>
          </div>
          {clusters.datos ? <Atlas oscuro clusters={clusters.datos} ubicaciones={u} seleccion={seleccion?.id} alElegir={setId} titulo="Mapa de ubicaciones"/> :
            clusters.error ? <ErrorCarga mensaje={clusters.error} reintentar={clusters.reintentar}/> : <Cargando/>}
        </section>
        <section className="tarjeta perfil">
          <p className="etiqueta">Ubicaciones propuestas</p><h2>Perfil de ubicación</h2>
          <div className="segmentos">{u.map(x => <button aria-pressed={seleccion?.id === x.id} key={x.id} onClick={() => setId(x.id)}>{x.id}</button>)}</div>
          {seleccion && <div key={seleccion.id} className="aparecer"><div className="perfil-grande"><b>{seleccion.id}</b><span>{seleccion.id === uc?.id ? 'Candidata preliminar' : 'Ubicación propuesta'}<small>{seleccion.zona_knn} · KNN</small></span></div>
            <dl className="ficha"><div><dt>A 1 km en línea recta</dt><dd>{seleccion.concesionarios_1km} negocios</dd></div>
            <div><dt>A 2 km en línea recta</dt><dd>{seleccion.concesionarios_2km} negocios</dd></div>
            <div><dt>Más cercano en línea recta</dt><dd>{metros(seleccion.distancia_mas_cercano_m)}</dd></div></dl>
          </div>}
          <Hallazgo ubicaciones={u}/>
          <Link className="enlace-mapa" to="/comparacion">Comparar ubicaciones <ArrowUpRight size={15}/></Link>
        </section>
      </div>
      <Destacados items={[
        {
          cifra: metros(proximo.distancia_mas_cercano_m),
          titulo: `El competidor más pegado está junto a ${proximo.id}`,
          texto: `${proximo.establecimiento_mas_cercano} queda a ${metros(proximo.distancia_mas_cercano_m)} de ${proximo.id}${proximo.id === candidata?.id ? ', aunque es la ubicación con menos competencia a 1 km' : ''}. Después hay un salto: el tercer vecino está a ${metros(proximo.distancia_tercer_vecino_m)}.`,
        },
        {
          cifra: metros(densa.distancia_tercer_vecino_m),
          titulo: `${densa.id} tiene ${densa.vecinos_knn.length} concesionarios en ese radio`,
          texto: `Los ${densa.vecinos_knn.length} vecinos más cercanos de ${densa.id} caben en ${metros(densa.distancia_tercer_vecino_m)}: es el entorno con mayor concentración de competencia.`,
        },
      ]} />

      <PorQue items={[
        {
          cifra: `${r.establecimientos_entrenamiento} de ${r.establecimientos_analizados}`,
          texto: `OpenStreetMap devolvió ${r.establecimientos_analizados} establecimientos automotores. Dejamos fuera ${r.pendientes_revision} pendientes de revisión, ${r.excluidos_confirmados} que no vende vehículos y ${r.perifericos} fuera del núcleo de 5 km. Quedan ${r.establecimientos_entrenamiento} para entrenar los modelos.`,
        },
        {
          cifra: `${r.clusters} zonas`,
          texto: mejorSil && mejorSil.k !== r.clusters
            ? `k = ${r.clusters} tiene silhouette ${decimal(r.silhouette, 3)}. k = ${mejorSil.k} puntúa más (${decimal(mejorSil.silhouette, 3)}) pero crea grupos de ${mejorSil.min_cluster_size} establecimiento; exigimos al menos 3 por zona.`
            : `k = ${r.clusters} obtiene el mejor silhouette (${decimal(r.silhouette, 3)}).`,
        },
        {
          cifra: `${r.ubicaciones_propuestas} ubicaciones`,
          texto: `A, B y C son puntos de prueba que propusimos dentro del distrito de San Salvador (${entero(r.poblacion.distrito_san_salvador)} habitantes, Censo 2024). No son locales disponibles.`,
        },
        {
          cifra: candidata ? `${candidata.id}: ${candidata.ganadas.length} de ${candidata.total}` : 'Sin candidata',
          texto: candidata
            ? `${candidata.id} tiene la menor competencia en ${candidata.ganadas.length} de ${candidata.total} medidas (${candidata.ganadas.join(', ')}). Por eso la marcamos como candidata preliminar, no como la más rentable.`
            : 'Ninguna ubicación gana la mayoría de las medidas de competencia.',
        },
      ]} />

      <Seccion titulo="El recorrido del análisis" texto="Cada sección responde una pregunta y alimenta a la siguiente." />
      <ol className="grid gap-3 md:grid-cols-2">
        {PASOS.slice(1).map((p, i) => (
          <li key={p.a}>
            <Link to={p.a} className="group flex h-full items-center gap-4 rounded-[13px] bg-superficie px-5 py-4 transition-colors hover:bg-superficie-2">
              <span className="text-sm font-semibold tabular-nums text-tenue">{dos(i + 1)}</span>
              <span className="min-w-0 flex-1 text-[15px] font-medium">{p.titulo}</span>
              <ArrowUpRight className="size-4 shrink-0 text-tenue group-hover:text-texto" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>

      <Panel className="mt-6">
        <Etiqueta>Estado de los datos</Etiqueta>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {e && [
            { t: 'Modelo KNN', ok: e.modelo_knn }, { t: 'Límites OPAMSS', ok: e.limites_opamss },
            { t: 'Red vial', ok: e.red_vial },
          ].map((c) => (
            <li key={c.t} className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${c.ok ? 'bg-texto' : 'bg-aviso'}`} aria-hidden />
              {c.t}<span className="sr-only">{c.ok ? ': disponible' : ': no disponible'}</span>
            </li>
          ))}
          <li className="text-tenue">OSM extraído: {fecha(r.fecha_extraccion_osm)}</li>
          <li className="text-tenue">Último cálculo: {fecha(r.fecha_calculo)}</li>
        </ul>
        {e && e.avisos.length > 0 && <p className="mt-2 text-sm text-aviso">{e.avisos.join(' ')}</p>}
      </Panel>
    </>
  )
}
