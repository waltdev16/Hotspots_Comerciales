import { Atlas } from '../components/Atlas'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { Cargando, ErrorCarga } from '../components/ui'
import {
  BarraPista, Bloque, Cabecera, Destacados, Etiqueta, Lectura, Muestra, Panel, PorQue, SiguienteEtapa,
} from '../components/narrativa'
import { colorZona } from '../services/colores'
import { decimal, metros } from '../services/formato'

// Distancia entre dos coordenadas (haversine), solo para describir la separación de los centroides.
const distanciaM = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const r = Math.PI / 180
  const h = Math.sin(((b.latitude - a.latitude) * r) / 2) ** 2
    + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(((b.longitude - a.longitude) * r) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

export default function KMeans() {
  const clusters = useApi(api.clusters)
  const ubic = useApi(api.ubicaciones)
  const resumen = useApi(api.resumen)

  if (clusters.cargando || ubic.cargando) return <Cargando />
  if (clusters.error || !clusters.datos) return <ErrorCarga mensaje={clusters.error ?? 'Sin datos'} reintentar={clusters.reintentar} />
  if (ubic.error || !ubic.datos) return <ErrorCarga mensaje={ubic.error ?? 'Sin datos'} reintentar={ubic.reintentar} />
  const c = clusters.datos
  const u = ubic.datos
  if (!c.grupos.length || !c.evaluacion_kmeans.length) return <p role="status">No hay grupos o evaluaciones de K-Means disponibles.</p>
  const r = resumen.datos
  const total = c.grupos.reduce((s, g) => s + g.count, 0)
  const maxCount = Math.max(...c.grupos.map((g) => g.count))
  const porTamano = [...c.grupos].sort((a, b) => b.count - a.count)
  const masCompacta = [...c.grupos].sort((a, b) => a.radio_medio_m - b.radio_medio_m)[0]
  const masDispersa = [...c.grupos].sort((a, b) => b.radio_medio_m - a.radio_medio_m)[0]
  const elegido = c.evaluacion_kmeans.find((e) => e.k === c.k)
  const mejorSil = [...c.evaluacion_kmeans].sort((a, b) => b.silhouette - a.silhouette)[0]
  const separacion = c.grupos.length >= 2 ? distanciaM(c.grupos[0], c.grupos[1]) : null
  const maxSil = Math.max(...c.evaluacion_kmeans.map((e) => e.silhouette))

  return (
    <>
      <Cabecera titulo={c.k === 2 ? 'Dos zonas, una distribución.' : `${c.k} zonas, una distribución.`}
        subtitulo="Identificamos concentraciones geográficas de establecimientos automotores." />


      <div className="grid gap-6 lg:grid-cols-5">
        <Bloque titulo="Concesionarios agrupados" className="lg:col-span-3"
          subtitulo="Explora las dos zonas, sus centroides y las propuestas. Acerca el gráfico para distinguir establecimientos vecinos."
          lectura={<Lectura
            mostramos="La posición de cada concesionario según la zona que le asignó K-Means."
            significa={`${porTamano[0].zona} reúne más establecimientos (${porTamano[0].count}); ${masCompacta.zona} es la más compacta (${metros(masCompacta.radio_medio_m)} de distancia media a su centro).`}
            concluimos="Observamos dos núcleos de actividad automotriz bien separados. Son agrupaciones geográficas, no niveles de rentabilidad." />}>
          <Atlas clusters={c} ubicaciones={u}/>
          <h3 className="mt-4 font-semibold">¿Qué representa este gráfico?</h3>
          <p className="mt-1 text-sm text-tenue">K-Means agrupa los concesionarios por cercanía. Cada diana marca el centro calculado de su grupo. Elegir un local requiere además evaluar demanda y costos.</p>
        </Bloque>

        <div className="space-y-4 lg:col-span-2">
          {c.grupos.map((g) => (
            <Panel key={g.zona} as="article" className="!p-6">
              <div className="flex items-start justify-between gap-4">
                <h3 className="flex items-center gap-2 text-[17px] font-semibold"><Muestra color={colorZona(g.zona)} /> {g.zona}</h3>
                <p className="text-right text-[28px] font-semibold leading-none tabular-nums">{g.count}</p>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-tenue">Distancia media al centro</dt><dd className="font-semibold">{metros(g.radio_medio_m)}</dd></div>
                <div><dt className="text-xs text-tenue">Distancia máxima</dt><dd className="font-semibold">{metros(g.radio_max_m)}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-tenue">{Math.round((g.count / total) * 100)} % de los {total} concesionarios · centroide {g.latitude.toFixed(4)}, {g.longitude.toFixed(4)}</p>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium text-tenue hover:text-texto">Ver los {g.count} concesionarios</summary>
                <ul className="mt-2 columns-2 gap-4 text-xs text-tenue">{g.miembros.map((m) => <li key={m.osm_id} className="py-0.5">{m.name}</li>)}</ul>
              </details>
            </Panel>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_330px]">
        <Panel>
          <h2 className="text-[22px] font-semibold">Establecimientos por zona</h2>
          <p className="mt-2 text-[13px] text-tenue">{total} registros incluidos en el entrenamiento del modelo.</p>
          <ul className="mt-12 space-y-12">
            {c.grupos.map((g) => (
              <li key={g.zona} className="grid grid-cols-[90px_1fr_40px] items-center gap-4 md:grid-cols-[205px_1fr_70px]">
                <span className="text-[15px] font-medium">{g.zona}</span>
                <BarraPista valor={g.count} maximo={maxCount} color={colorZona(g.zona)} etiqueta={`${g.zona}: ${g.count}`} />
                <span className="text-base font-semibold tabular-nums">{g.count}</span>
              </li>
            ))}
          </ul>
          <div className="mt-12 h-px bg-linea" />
          <p className="mt-6 text-[15px] font-medium">
            {porTamano.length >= 2
              ? `La ${porTamano[0].zona} agrupa ${porTamano[0].count} negocios; la ${porTamano[1].zona} reúne ${porTamano[1].count}.`
              : `${porTamano[0].zona} agrupa ${porTamano[0].count} negocios.`}
          </p>
          <p className="mt-5 text-[13px] text-tenue">Estos grupos no indican niveles de ventas o demanda.</p>
        </Panel>

        <Panel className="flex flex-col">
          <Etiqueta>Evaluación del modelo</Etiqueta>
          <p className="mt-11 text-[37px] font-semibold leading-none tabular-nums">{decimal(elegido?.silhouette ?? c.silhouette, 3)}</p>
          <p className="mt-3 text-[13px] text-tenue">Índice silhouette para k = {c.k}</p>
          <div className="mb-6 mt-16 h-px bg-linea" />
          <p className="text-sm font-medium leading-snug">Mide qué tan separados y cohesionados están los grupos.</p>
          <p className="mt-3 text-[13px] leading-relaxed text-tenue">Va de −1 a 1. Por encima de 0.5 se considera una estructura razonable: en promedio, cada negocio está más cerca de su zona que de la otra.</p>
        </Panel>
      </div>

      <Panel className="mt-6">
        <h2 className="text-[20px] font-semibold">¿Por qué utilizamos {c.k === 2 ? 'dos' : c.k} grupos?</h2>
        <p className="mt-4 text-[15px] text-tenue">Comparamos varios valores de k y consideramos el equilibrio entre separación y tamaño de los grupos.</p>
        <ul className="mt-6 space-y-3">
          {c.evaluacion_kmeans.map((e) => {
            const valido = e.min_cluster_size >= 3
            return (
              <li key={e.k} className="grid grid-cols-[52px_1fr_52px] items-center gap-3 text-sm md:grid-cols-[60px_1fr_60px_220px] md:gap-5">
                <span className={e.k === c.k ? 'font-semibold' : 'text-tenue'}>k = {e.k}</span>
                <BarraPista valor={e.silhouette} maximo={maxSil} alto={11}
                  color={e.k === c.k ? '#333639' : valido ? '#969c94' : '#d2d3d0'} etiqueta={`k = ${e.k}: silhouette ${decimal(e.silhouette, 3)}`} />
                <span className="tabular-nums">{decimal(e.silhouette, 3)}</span>
                <span className={`col-span-3 text-xs md:col-span-1 ${valido ? 'text-tenue' : 'text-negativo'}`}>
                  {e.k === c.k ? 'Elegido' : valido ? `Grupo más pequeño: ${e.min_cluster_size}` : `Descartado: un grupo de ${e.min_cluster_size}`}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mt-5 text-[13px] text-tenue">{c.criterio}.</p>
      </Panel>

      <Destacados items={[
        {
          cifra: `${decimal(masDispersa.radio_medio_m / masCompacta.radio_medio_m, 1)}×`,
          titulo: `La ${masCompacta.zona} es más compacta`,
          texto: `Sus negocios están, en promedio, a ${metros(masCompacta.radio_medio_m)} de su centro; en la ${masDispersa.zona}, a ${metros(masDispersa.radio_medio_m)}. Es un corredor automotor denso.`,
        },
        {
          cifra: separacion !== null ? metros(separacion) : '—',
          titulo: 'Separan los centros de las dos zonas',
          texto: 'Distancia en línea recta entre los centroides. Son dos núcleos comerciales distintos, no uno solo partido en dos.',
        },
        {
          cifra: decimal(mejorSil.silhouette, 3),
          titulo: `El silhouette más alto (k = ${mejorSil.k}) no es el elegido`,
          texto: mejorSil.k !== c.k
            ? `Con k = ${mejorSil.k} aparecen grupos de ${mejorSil.min_cluster_size} negocio: un punto aislado no es una zona. Por eso preferimos k = ${c.k}.`
            : `k = ${c.k} es a la vez el más alto y el que cumple el tamaño mínimo.`,
        },
      ]} />

      <PorQue items={[
        {
          cifra: `${total} registros`,
          texto: r
            ? `De ${r.establecimientos_analizados} establecimientos de OpenStreetMap, entrenamos solo con los ${r.establecimientos_entrenamiento} confirmados dentro del núcleo comercial (quitamos ${r.pendientes_revision} pendientes, ${r.excluidos_confirmados} excluido y ${r.perifericos} periféricos).`
            : 'Solo los concesionarios confirmados dentro del núcleo comercial.',
        },
        { cifra: 'Solo posición', texto: 'K-Means recibe latitud y longitud convertidas a metros (UTM 16N). No conoce ventas, marcas ni precios, por eso las zonas describen cercanía, no éxito comercial.' },
        { cifra: 'Mínimo 3 por zona', texto: 'Una zona con uno o dos negocios es un punto aislado, no una concentración. Ese criterio descarta los k que puntúan más alto.' },
        { cifra: `Semilla ${c.semilla}`, texto: 'Fijamos la semilla aleatoria y 20 inicializaciones para que cualquier persona obtenga exactamente las mismas zonas al repetir el cálculo.' },
      ]} />

      <SiguienteEtapa actual={4} texto="Usamos estas zonas para clasificar las ubicaciones A, B y C con KNN." />
    </>
  )
}
