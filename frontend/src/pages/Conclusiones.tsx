import { Link } from 'react-router'
import { Check, CircleHelp, X } from 'lucide-react'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { Cargando, ErrorCarga } from '../components/ui'
import { Cabecera, Destacados, PASOS } from '../components/narrativa'
import { candidataPreliminar, competidorMasProximo } from '../services/analisis'
import { decimal, metros, pct } from '../services/formato'

export default function Conclusiones() {
  const resumen = useApi(api.resumen)
  const clusters = useApi(api.clusters)
  const ubic = useApi(api.ubicaciones)

  if (resumen.cargando || clusters.cargando || ubic.cargando) return <Cargando />
  const error = resumen.error ?? clusters.error ?? ubic.error
  if (error || !resumen.datos || !clusters.datos || !ubic.datos) return <ErrorCarga mensaje={error ?? 'Sin datos'} />
  const r = resumen.datos
  const c = clusters.datos
  const u = ubic.datos
  if (!u.length) return <p role="status">No hay ubicaciones para resumir.</p>
  const candidata = candidataPreliminar(u)
  const proximo = competidorMasProximo(u)
  const masCompetida = [...u].sort((a, b) => b.concesionarios_1km - a.concesionarios_1km)[0]
  const rodeos = u.map((x) => x.indice_rodeo_medio).filter((v): v is number => v !== null)

  const hallazgos = [
    {
      titulo: 'Distribución',
      texto: `De ${r.establecimientos_analizados} establecimientos de OpenStreetMap, ${r.establecimientos_entrenamiento} son concesionarios dentro del núcleo comercial.`,
      enlace: '/mapa',
    },
    {
      titulo: 'K-Means',
      texto: `Identificamos ${c.k} agrupaciones: ${c.grupos.map((g) => `${g.zona} con ${g.count}`).join(' y ')} concesionarios.`,
      enlace: '/kmeans',
    },
    {
      titulo: 'KNN',
      texto: `${u.map((x) => `${x.id} pertenece a ${x.zona_knn}`).join(', ')}. KNN coincide con K-Means en el ${decimal(r.acuerdo_knn_kmeans * 100, 1)} % de los casos.`,
      enlace: '/knn',
    },
    {
      titulo: 'Comparación',
      texto: `${masCompetida.id} tiene la mayor competencia inmediata (${masCompetida.concesionarios_1km} concesionarios a 1 km).${candidata ? ` ${candidata.id} tiene la menor concentración en ${candidata.ganadas.length} de ${candidata.total} medidas.` : ''}`,
      enlace: '/comparacion',
    },
  ]

  const afirmamos = [
    `Los concesionarios del área forman ${c.k} agrupaciones geográficas separadas.`,
    candidata
      ? `La ubicación ${candidata.id} es la candidata preliminar si el criterio es evitar la competencia cercana.`
      : 'Ninguna ubicación domina en competencia cercana.',
    `Las distancias por calle son entre ${decimal(Math.min(...rodeos), 2)} y ${decimal(Math.max(...rodeos), 2)} veces la línea recta: medir en línea recta subestima los recorridos.`,
  ].filter(Boolean)

  const noAfirmamos = [
    'Que alguna ubicación vaya a vender más: no tenemos datos de demanda ni de ventas locales.',
    'Que menos competidores signifique más clientes: una zona con muchos concesionarios también atrae compradores.',
    `Que ${proximo.id} esté libre de competencia: tiene el competidor individual más cercano, a ${metros(proximo.distancia_mas_cercano_m)}.`,
  ]

  const pendientes = [
    ['Demanda', 'Ingresos de los hogares y parque de vehículos de lujo por zona.'],
    ['Tráfico y acceso', 'Aforos vehiculares, sentidos de circulación y tiempos de viaje en horas pico.'],
    ['Verificación en campo', `Los ${r.pendientes_revision} establecimientos pendientes de revisión y la cobertura de OpenStreetMap.`],
    ['Centro existente', 'El efecto de una nueva sede sobre el Porsche Center actual en Antiguo Cuscatlán.'],
  ]

  const aprendimos = [
    'Proyectar las coordenadas a metros es indispensable para que K-Means y KNN midan distancias reales.',
    'El mejor silhouette no siempre es la mejor elección: un grupo de un solo concesionario no es una zona.',
    'La coincidencia entre KNN y K-Means mide coherencia del modelo, no aciertos comerciales.',
    'Separar datos observados, derivados y supuestos hace visible qué partes del análisis son hipotéticas.',
  ]

  return (
    <>
      <Cabecera titulo="Lo que sabemos y lo que falta."
        subtitulo="Reunimos lo que observamos en cada sección, lo que podemos afirmar con los datos disponibles y lo que todavía falta investigar." />

      <Destacados items={[
        candidata ? {
          cifra: `${u.find((x) => x.id === candidata.id)?.concesionarios_1km} vs ${masCompetida.concesionarios_1km}`,
          titulo: `Competidores a 1 km: ${candidata.id} frente a ${masCompetida.id}`,
          texto: `${candidata.id} es la candidata preliminar: menor competencia en ${candidata.ganadas.length} de ${candidata.total} medidas. Ojo: su competidor más cercano está a ${metros(u.find((x) => x.id === candidata.id)?.distancia_mas_cercano_m)}.`,
        } : { cifra: '—', titulo: 'Sin candidata clara', texto: 'Ninguna ubicación gana la mayoría de las medidas de competencia.' },
        {
          cifra: pct(c.acuerdo_loo * 100, 1),
          titulo: 'Coherencia entre K-Means y KNN',
          texto: `Las ${c.k} zonas son consistentes en el espacio (silhouette ${decimal(c.silhouette, 2)}). Describen cercanía entre negocios, no ventas.`,
        },
      ]} />

      <section className="mt-12">
        <h2 className="text-[22px] font-semibold">Lo que observamos</h2>
        <ol className="mt-4 space-y-2">
          {[...hallazgos].sort((a, b) => PASOS.findIndex((p) => p.a === a.enlace) - PASOS.findIndex((p) => p.a === b.enlace)).map((h, i) => (
            <li key={h.titulo}>
              <Link to={h.enlace} className="flex gap-4 rounded-[13px] bg-superficie px-5 py-4 transition-colors hover:bg-superficie-2">
                <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-tenue">{String(i + 1).padStart(2, '0')}</span>
                <div><p className="text-sm font-semibold">{h.titulo}</p><p className="mt-0.5 text-sm text-tenue">{h.texto}</p></div>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="tarjeta p-6">
          <h2 className="text-[18px] font-semibold">Qué concluimos</h2>
          <ul className="mt-3 space-y-2.5 text-sm">
            {afirmamos.map((t) => <li key={t} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />{t}</li>)}
          </ul>
        </div>
        <div className="tarjeta p-6">
          <h2 className="text-[18px] font-semibold">Qué no podemos afirmar</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-tenue">
            {noAfirmamos.map((t) => <li key={t} className="flex gap-2.5"><X className="mt-0.5 size-4 shrink-0 text-negativo" aria-hidden />{t}</li>)}
          </ul>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[22px] font-semibold">Qué falta investigar</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pendientes.map(([t, d]) => (
            <div key={t} className="rounded-[13px] border border-dashed border-[#c9cbc6] p-5">
              <p className="flex items-center gap-2 text-sm font-semibold"><CircleHelp className="size-4 text-tenue" aria-hidden />{t}</p>
              <p className="mt-1 text-sm text-tenue">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 border-t border-linea pt-8">
        <h2 className="text-[22px] font-semibold">Qué aprendimos</h2>
        <ul className="mt-3 grid gap-x-8 gap-y-2 text-sm text-tenue md:grid-cols-2">
          {aprendimos.map((t) => <li key={t} className="border-l-2 border-linea pl-3">{t}</li>)}
        </ul>
      </section>

      <Link to="/datos" className="mt-10 inline-block text-sm text-texto hover:underline">Consultar los datos y las fuentes</Link>
    </>
  )
}
