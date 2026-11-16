import { Link } from 'react-router'
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MousePointerClick } from 'lucide-react'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { Cargando, ErrorCarga, TooltipGrafico } from '../components/ui'
import { Bloque, Cabecera, Destacados, Lectura, Muestra, Panel, PorQue, SiguienteEtapa } from '../components/narrativa'
import { Vecindarios } from '../components/Atlas'
import { candidataPreliminar, minimos } from '../services/analisis'
import { colorZona } from '../services/colores'
import { decimal, metros, pct } from '../services/formato'

const PALABRA: Record<number, string> = { 1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco' }

export default function KNN() {
  const clusters = useApi(api.clusters)
  const ubic = useApi(api.ubicaciones)

  if (clusters.cargando || ubic.cargando) return <Cargando />
  if (ubic.error || !ubic.datos) return <ErrorCarga mensaje={ubic.error ?? 'Sin datos'} reintentar={ubic.reintentar} />
  if (clusters.error || !clusters.datos) return <ErrorCarga mensaje={clusters.error ?? 'Sin datos'} reintentar={clusters.reintentar} />
  const u = ubic.datos
  const c = clusters.datos
  if (!u.length || !c.evaluacion_knn.length) return <p role="status">No hay propuestas o evaluaciones de KNN disponibles.</p>
  const k = c.knn_k
  const total = c.grupos.reduce((s, g) => s + g.count, 0)
  const errores = Math.round((1 - c.acuerdo_loo) * total)
  const candidata = candidataPreliminar(u)
  const menor1k = minimos(u, 'concesionarios_1km')
  const masDisperso = [...u].sort((a, b) => b.distancia_tercer_vecino_m - a.distancia_tercer_vecino_m)[0]
  const masDenso = [...u].sort((a, b) => a.distancia_tercer_vecino_m - b.distancia_tercer_vecino_m)[0]
  const acuerdo = c.evaluacion_knn.map((e) => ({ k: e.k, acuerdo: e.acuerdo_loo * 100 }))
  const mejorK = [...c.evaluacion_knn].sort((a, b) => b.acuerdo_loo - a.acuerdo_loo || a.k - b.k)[0]
  const valoresK = c.evaluacion_knn.map((e) => e.k)
  // La zona de cada ubicación es estable si no cambia con ningún número de vecinos evaluado.
  const estables = u.filter((x) => new Set(Object.values(c.estabilidad_knn?.[x.id] ?? {})).size === 1).map((x) => x.id)

  return (
    <>
      <Cabecera titulo="¿A qué zona pertenece cada ubicación?"
        subtitulo={`KNN asigna la zona predominante entre los ${PALABRA[k] ?? k} establecimientos más cercanos.`}>
        <Link to="/mapa" className="inline-flex items-center gap-2 rounded-full border border-linea bg-superficie px-4 py-2 text-xs font-medium hover:bg-superficie-2">
          <MousePointerClick className="size-3.5" /> Clasificar otra ubicación
        </Link>
      </Cabecera>

      <Vecindarios ubicaciones={u}/>
      <p className="my-4 text-sm text-tenue">KNN analiza los establecimientos cercanos a cada propuesta y utiliza sus grupos para clasificar la ubicación. Los diagramas parten de la misma escala. Los anillos marcan 250 m, 500 m y 1 km.</p>
      <Panel>
        <h2 className="text-[21px] font-semibold">Clasificación de los tres puntos de prueba</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {u.map((x) => {
            const enZona = x.vecinos_knn.filter((v) => v.zona === x.zona_knn).length
            const esC = x.id === candidata?.id
            return (
              <article key={x.id} className={`min-h-[216px] rounded-[12px] p-6 ${esC ? 'bg-superficie-2' : 'bg-fondo'}`}>
                <p className="text-[37px] font-semibold leading-none">{x.id}</p>
                <p className="mt-4 flex items-center gap-2 text-[13px] text-tenue"><Muestra color={colorZona(x.zona_knn)} />{x.zona_knn}</p>
                <p className="mt-10 text-[13px] text-tenue">{enZona} de {x.vecinos_knn.length} vecinos de esta zona</p>
                <p className="mt-1 text-[13px] text-tenue">El más lejano a {metros(x.distancia_tercer_vecino_m)}</p>
                {menor1k.length === 1 && menor1k[0] === x.id && (
                  <p className="mt-6 text-[11px] font-semibold uppercase">Menor concentración a 1 km</p>
                )}
              </article>
            )
          })}
        </div>
      </Panel>

      <Panel className="mt-6 grid gap-6 md:grid-cols-[1fr_1px_1fr] md:gap-8">
        <div>
          <p className="text-[37px] font-semibold leading-none tabular-nums">{pct(c.acuerdo_loo * 100, 1)}</p>
          <p className="mt-3 text-[13px] text-tenue">Acuerdo con etiquetas K-Means en validación leave-one-out</p>
          <p className="mt-6 text-[13px] text-tenue">{total - errores} de {total} concesionarios recibieron la misma zona al clasificarlos sin verse a sí mismos.</p>
        </div>
        <div className="hidden bg-linea md:block" />
        <div>
          <p className="text-[15px] font-medium">Mide coincidencia con el agrupamiento previo.</p>
          <p className="mt-6 text-sm text-tenue">No es una predicción de éxito comercial.</p>
          <p className="mt-6 text-[13px] text-tenue">KNN clasifica ubicaciones; no estima ingresos ni demanda.</p>
        </div>
      </Panel>

      <Destacados items={[
        {
          cifra: `${estables.length} de ${u.length}`,
          titulo: 'Ubicaciones que nunca cambian de zona',
          texto: estables.length === u.length
            ? `Probamos con ${valoresK.join(', ')} vecinos: A, B y C caen siempre en la misma zona. La clasificación no depende del valor de k.`
            : `${u.filter((x) => !estables.includes(x.id)).map((x) => x.id).join(' y ')} cambia de zona según el número de vecinos.`,
        },
        {
          cifra: `${errores} de ${total}`,
          titulo: 'Negocios en los que KNN discrepa de K-Means',
          texto: `Al retirar cada concesionario y clasificarlo con sus ${k} vecinos, solo ${errores === 1 ? 'uno cambia' : `${errores} cambian`} de zona.`,
        },
        {
          cifra: `${decimal(masDisperso.distancia_tercer_vecino_m / masDenso.distancia_tercer_vecino_m, 1)}×`,
          titulo: `Los vecinos de ${masDisperso.id} están más lejos que los de ${masDenso.id}`,
          texto: `El tercer vecino de ${masDisperso.id} está a ${metros(masDisperso.distancia_tercer_vecino_m)}; el de ${masDenso.id}, a ${metros(masDenso.distancia_tercer_vecino_m)}. El entorno inmediato de ${masDisperso.id} tiene menos concesionarios.`,
        },
      ]} />

      <PorQue items={[
        { cifra: `k = ${k}`, texto: `Usamos ${PALABRA[k] ?? k} vecinos porque es impar (no hay empates entre dos zonas) y suficiente para no depender de un solo negocio. Con ${mejorK.k} vecinos el acuerdo sube a ${pct(mejorK.acuerdo_loo * 100, 0)}, pero la zona de A, B y C no cambia, así que mantenemos el valor original.` },
        { cifra: 'Leave-one-out', texto: `Retiramos un concesionario, lo clasificamos con los ${total - 1} restantes y comparamos con su zona K-Means. Repetimos ${total} veces. Así medimos la coherencia sin usar datos que no tenemos.` },
        { cifra: `${pct(c.acuerdo_loo * 100, 1)} no es precisión`, texto: 'KNN aprende las zonas que creó K-Means. Un acuerdo alto confirma que las zonas son consistentes en el espacio, no que una ubicación venderá más.' },
        { cifra: 'Vecinos', texto: 'Solo cuentan los concesionarios usados en el entrenamiento, medidos en línea recta y en metros (UTM 16N).' },
      ]} />

      <div className="mt-6">
        <Bloque titulo="Qué tan coherente es KNN"
          subtitulo="Porcentaje de concesionarios a los que KNN asigna la misma zona que K-Means, según el número de vecinos."
          lectura={<Lectura
            mostramos="El acuerdo leave-one-out para distintos números de vecinos."
            significa={`Con ${k} vecinos coincide en el ${decimal(c.acuerdo_loo * 100, 1)} % de los casos${mejorK.k !== k ? `; con ${mejorK.k} llega al ${decimal(mejorK.acuerdo_loo * 100, 0)} %` : ''}.`}
            concluimos={estables.length === u.length
              ? `Mantenemos ${k} vecinos. La zona de A, B y C no cambia con ${valoresK.join(', ')} vecinos.`
              : `Mantenemos ${k} vecinos. La zona de ${u.filter((x) => !estables.includes(x.id)).map((x) => x.id).join(' y ')} cambia según el número de vecinos.`} />}>
          <div className="h-[240px]">
            <ResponsiveContainer>
              <LineChart data={acuerdo} margin={{ top: 20, right: 24, bottom: 0, left: -6 }}>
                <CartesianGrid strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="k" tickFormatter={(v: number) => `${v} vec.`} />
                <YAxis domain={[80, 100]} width={52} tickFormatter={(v: number) => `${v} %`} />
                <Tooltip content={<TooltipGrafico formato={(v) => `${decimal(v, 1)} %`} />} cursor={{ stroke: '#b9bcb6' }}
                  labelFormatter={(v) => `${v} vecinos`} />
                <Line isAnimationActive={false} dataKey="acuerdo" name="Coincidencia" stroke="#969c94" strokeWidth={2} dot={{ r: 3, fill: '#969c94', strokeWidth: 0 }} />
                <ReferenceDot x={k} y={c.acuerdo_loo * 100} r={6} fill="#17191c" stroke="#fff" strokeWidth={2}
                  label={{ value: 'Usado', position: 'top', fill: '#17191c', fontSize: 11, fontWeight: 600 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Bloque>
      </div>

      <SiguienteEtapa actual={5} texto="Reunimos lo que aprendimos al comparar las ubicaciones." />
    </>
  )
}
