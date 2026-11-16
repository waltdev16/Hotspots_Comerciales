import Radios from '../components/Radios'
import { useMemo, useState } from 'react'
import { ArrowDownUp, Check, Minus } from 'lucide-react'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import type { Ubicacion } from '../types/api'
import { Cargando, ErrorCarga } from '../components/ui'
import { Cabecera, Destacados, Lectura, Panel, PorQue, Seccion, SiguienteEtapa } from '../components/narrativa'
import { Medidor } from '../components/graficos'
import { candidataPreliminar, maximo, METRICAS_COMPETENCIA, minimos } from '../services/analisis'
import { decimal, entero, metros, NO_DISPONIBLE, pct } from '../services/formato'

type Categoria = 'Clasificación' | 'Población' | 'Competencia' | 'Accesibilidad'
interface Fila {
  clave: string
  categoria: Categoria
  texto: string
  valor: (u: Ubicacion) => number | string | null
  formato: (v: number | string | null) => string
  ayuda: string
}

const num = (f: (v: number) => string) => (v: number | string | null) => (typeof v === 'number' ? f(v) : v ?? NO_DISPONIBLE)
const RADIOS = ['#d2d3d0', '#969c94', '#333639']

const FILAS: Fila[] = [
  { clave: 'zona', categoria: 'Clasificación', texto: 'Zona KNN', valor: (u) => u.zona_knn, formato: (v) => String(v), ayuda: 'Agrupación a la que se parece la posición.' },
  { clave: 'proporcion', categoria: 'Clasificación', texto: 'Vecinos en la misma zona', valor: (u) => u.proporcion_vecinos_zona * 100, formato: num((v) => pct(v, 0)), ayuda: 'Proporción de los vecinos KNN que pertenece a la zona asignada.' },
  { clave: 'distrito', categoria: 'Población', texto: 'Distrito', valor: (u) => u.distrito, formato: (v) => String(v ?? NO_DISPONIBLE), ayuda: 'Unión espacial con los polígonos OPAMSS.' },
  { clave: 'poblacion', categoria: 'Población', texto: 'Población del distrito (2024)', valor: (u) => u.poblacion_2024, formato: num(entero), ayuda: 'Residentes de todo el distrito; no compradores.' },
  { clave: 'c500', categoria: 'Competencia', texto: 'Concesionarios a 500 m', valor: (u) => u.concesionarios_500m, formato: num(entero), ayuda: 'Línea recta.' },
  { clave: 'c1k', categoria: 'Competencia', texto: 'Concesionarios a 1 km', valor: (u) => u.concesionarios_1km, formato: num(entero), ayuda: 'Línea recta.' },
  { clave: 'c2k', categoria: 'Competencia', texto: 'Concesionarios a 2 km', valor: (u) => u.concesionarios_2km, formato: num(entero), ayuda: 'Línea recta.' },
  { clave: 'dmin', categoria: 'Competencia', texto: 'Distancia al más cercano', valor: (u) => u.distancia_mas_cercano_m, formato: num(metros), ayuda: 'Línea recta.' },
  { clave: 'r1k', categoria: 'Accesibilidad', texto: 'Competidores a 1 km por calle', valor: (u) => u.competidores_ruta_1km, formato: num(entero), ayuda: 'Ruta más corta en la red OSM.' },
  { clave: 'r2k', categoria: 'Accesibilidad', texto: 'Competidores a 2 km por calle', valor: (u) => u.competidores_ruta_2km, formato: num(entero), ayuda: 'Ruta más corta en la red OSM.' },
  { clave: 'rmin', categoria: 'Accesibilidad', texto: 'Competidor más cercano por calle', valor: (u) => u.competidor_vial_mas_cercano_m, formato: num(metros), ayuda: 'Sin tráfico; no se convierte a tiempo.' },
  { clave: 'rodeo', categoria: 'Accesibilidad', texto: 'Índice de rodeo mediano', valor: (u) => u.indice_rodeo_medio, formato: num((v) => decimal(v, 2)), ayuda: 'Distancia por calle ÷ línea recta. Cerca de 1 = trayectos directos.' },
]
const CATEGORIAS: Categoria[] = ['Clasificación', 'Población', 'Competencia', 'Accesibilidad']

// Observaciones factuales a partir de los indicadores, sin presentarlas como garantía.
function observaciones(u: Ubicacion, todas: Ubicacion[]) {
  const ventajas: string[] = []
  const limites: string[] = []
  for (const m of METRICAS_COMPETENCIA) {
    const ids = minimos(todas, m.clave)
    if (ids.length === 1 && ids[0] === u.id) ventajas.push(`Menos competidores ${m.texto} (${u[m.clave] as number}).`)
  }
  if (u.concesionarios_1km === maximo(todas, 'concesionarios_1km')) limites.push(`La mayor competencia inmediata: ${u.concesionarios_1km} concesionarios a 1 km.`)
  const proximo = [...todas].sort((a, b) => a.distancia_mas_cercano_m - b.distancia_mas_cercano_m)[0]
  if (proximo.id === u.id) limites.push(`Tiene el competidor individual más cercano: ${u.establecimiento_mas_cercano}, a ${metros(u.distancia_mas_cercano_m)}.`)
  if (u.competidor_vial_mas_cercano_m !== null && u.competidor_vial_mas_cercano_m < 300) limites.push(`Un competidor a ${metros(u.competidor_vial_mas_cercano_m)} por calle.`)
  const rodeo = [...todas].filter((x) => x.indice_rodeo_medio !== null).sort((a, b) => a.indice_rodeo_medio! - b.indice_rodeo_medio!)[0]
  if (rodeo?.id === u.id) ventajas.push(`Recorridos por calle más directos (índice ${decimal(u.indice_rodeo_medio, 2)}).`)
  if (u.concesionarios_2km === maximo(todas, 'concesionarios_2km')) ventajas.push(`Mayor actividad automotriz a 2 km (${u.concesionarios_2km} concesionarios).`)
  if (!u.dentro_area_estudio) limites.push('Fuera del área de estudio de KNN.')
  if (u.proporcion_vecinos_zona < 1) limites.push('Sus vecinos KNN pertenecen a zonas distintas.')
  return { ventajas, limites }
}

export default function Comparador() {
  const ubic = useApi(api.ubicaciones)
  const [filtro, setFiltro] = useState<Set<Categoria>>(new Set(CATEGORIAS))
  const [orden, setOrden] = useState<string>('')
  const [ascendente, setAscendente] = useState(true)

  const columnas = useMemo(() => {
    const lista = [...(ubic.datos ?? [])]
    const fila = FILAS.find((f) => f.clave === orden)
    if (!fila) return lista
    return lista.sort((a, b) => {
      const va = fila.valor(a), vb = fila.valor(b)
      if (va === null) return 1
      if (vb === null) return -1
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return ascendente ? c : -c
    })
  }, [ubic.datos, orden, ascendente])

  if (ubic.cargando) return <Cargando />
  if (ubic.error || !ubic.datos) return <ErrorCarga mensaje={ubic.error ?? 'Sin datos'} reintentar={ubic.reintentar} />
  const u = ubic.datos
  if (!u.length) return <p role="status">No hay ubicaciones disponibles para comparar.</p>
  const candidata = candidataPreliminar(u)
  const filas = FILAS.filter((f) => filtro.has(f.categoria))
  const alternar = (c: Categoria) => {
    const s = new Set(filtro)
    if (s.has(c)) s.delete(c); else s.add(c)
    setFiltro(s)
  }
  const max = {
    c500: maximo(u, 'concesionarios_500m'), c1k: maximo(u, 'concesionarios_1km'), c2k: maximo(u, 'concesionarios_2km'),
    r1k: maximo(u, 'competidores_ruta_1km'), r2k: maximo(u, 'competidores_ruta_2km'),
    dmin: maximo(u, 'distancia_mas_cercano_m'), rmin: maximo(u, 'competidor_vial_mas_cercano_m'),
  }
  const mas1k = [...u].sort((a, b) => b.concesionarios_1km - a.concesionarios_1km)[0]
  const menos1k = [...u].sort((a, b) => a.concesionarios_1km - b.concesionarios_1km)[0]
  const razon = menos1k.concesionarios_1km > 0 ? Math.round(mas1k.concesionarios_1km / menos1k.concesionarios_1km) : mas1k.concesionarios_1km
  // Mayor salto entre competidores por calle a 1 km y a 2 km.
  const conRed = u.filter((x) => x.competidores_ruta_1km !== null && x.competidores_ruta_2km !== null)
  const saltoVial = [...conRed].sort((a, b) => (b.competidores_ruta_2km! - b.competidores_ruta_1km!) - (a.competidores_ruta_2km! - a.competidores_ruta_1km!))[0]
  const conRodeo = u.filter((x) => x.indice_rodeo_medio !== null).sort((a, b) => a.indice_rodeo_medio! - b.indice_rodeo_medio!)
  const directa = conRodeo[0]
  const rodeosa = conRodeo.at(-1)

  return (
    <>
      <Cabecera titulo="Tres opciones. Datos comparables."
        subtitulo="Número de negocios automotores cercanos; no equivale a clientes potenciales." />

      <Radios ubicaciones={u}/>
      <Panel className="mt-6">
        <h2 className="text-[18px] font-semibold">Negocios a menos de 2 km por carretera</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {u.map((x) => (
            <p key={x.id} className="flex items-baseline gap-5">
              <span className="text-[30px] font-semibold tabular-nums">{x.competidores_ruta_2km ?? '—'}</span>
              <span className="text-sm text-tenue">Ubicación {x.id}</span>
            </p>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-tenue">Menor concentración no implica automáticamente mayor demanda o ventas.</p>
      </Panel>

      <Seccion titulo="Detalle por ubicación" texto="Lo que favorece y lo que limita a cada opción según los indicadores calculados." />
      <div className="grid gap-4 lg:grid-cols-3">
        {u.map((x) => {
          const o = observaciones(x, u)
          const esCandidata = candidata?.id === x.id
          return (
            <article key={x.id} className={`tarjeta comparativa ${esCandidata ? 'candidata' : ''}`}>
              <header className="px-6 pt-6">
                <p className="text-[37px] font-semibold leading-none">Ubicación {x.id}</p>
                <p className="mt-2 text-[13px] text-tenue">{x.zona_knn}{esCandidata ? ' · Candidata preliminar' : ''}</p>
              </header>
              <div className="space-y-5 px-6 py-5">
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase text-tenue">Concesionarios en línea recta</h3>
                  <div className="space-y-2.5">
                    <Medidor etiqueta="Hasta 500 m" valor={x.concesionarios_500m} maximo={max.c2k} texto={String(x.concesionarios_500m)} color={RADIOS[0]} />
                    <Medidor etiqueta="Hasta 1 km" valor={x.concesionarios_1km} maximo={max.c2k} texto={String(x.concesionarios_1km)} color={RADIOS[2]} />
                    <Medidor etiqueta="Hasta 2 km" valor={x.concesionarios_2km} maximo={max.c2k} texto={String(x.concesionarios_2km)} color={RADIOS[1]} />
                  </div>
                </section>
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase text-tenue">Distancias</h3>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-xs text-tenue">Más cercano en línea recta</dt><dd className="font-semibold">{metros(x.distancia_mas_cercano_m)}</dd><dd className="truncate text-xs text-tenue" title={x.establecimiento_mas_cercano}>{x.establecimiento_mas_cercano}</dd></div>
                    <div><dt className="text-xs text-tenue">Más cercano por calle</dt><dd className="font-semibold">{metros(x.competidor_vial_mas_cercano_m)}</dd><dd className="truncate text-xs text-tenue" title={x.competidor_vial_mas_cercano ?? ''}>{x.competidor_vial_mas_cercano ?? NO_DISPONIBLE}</dd></div>
                  </dl>
                  {x.estado_red === 'ok' && <p className="mt-2 text-xs text-tenue">Por calle: {x.competidores_ruta_1km} a 1 km, {x.competidores_ruta_2km} a 2 km. Índice de rodeo {decimal(x.indice_rodeo_medio, 2)}.</p>}
                </section>
              </div>
              <details className="mt-auto grid gap-4 border-t border-linea px-6 py-5 text-sm"><summary>Ventajas y limitaciones</summary>
                <div>
                  <h3 className="text-[11px] font-semibold uppercase text-tenue">Ventajas observadas</h3>
                  <ul className="mt-1.5 space-y-1">
                    {o.ventajas.length ? o.ventajas.map((v) => (
                      <li key={v} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />{v}</li>
                    )) : <li className="text-tenue">Ninguna destacada con los indicadores disponibles.</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="text-[11px] font-semibold uppercase text-tenue">Limitaciones</h3>
                  <ul className="mt-1.5 space-y-1 text-tenue">
                    {[...o.limites, 'Sin datos locales de demanda, tráfico ni costo del inmueble.'].map((v) => (
                      <li key={v} className="flex gap-2"><Minus className="mt-0.5 size-3.5 shrink-0" aria-hidden />{v}</li>
                    ))}
                  </ul>
                </div>
              </details>
            </article>
          )
        })}
      </div>
      <div className="mt-4">
        <Lectura
          mostramos="Cuántos concesionarios rodean cada ubicación en línea recta y por calle."
          significa={`${mas1k.id} concentra la competencia más inmediata (${mas1k.concesionarios_1km} a 1 km); ${menos1k.id} la menor (${menos1k.concesionarios_1km}).`}
          concluimos={candidata
            ? `${candidata.id} es la candidata preliminar por menor competencia. Esto describe la oferta existente, no la demanda.`
            : 'Ninguna ubicación tiene menor competencia en la mayoría de los radios.'} />
      </div>

      {/* Tabla completa con filtros y orden */}
      <section className="mt-6 rounded-[13px] border-t border-linea bg-superficie p-6 md:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-[20px] font-semibold">Todos los indicadores</h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar categorías">
            {CATEGORIAS.map((c) => (
              <button key={c} onClick={() => alternar(c)} aria-pressed={filtro.has(c)}
                className={`rounded-full border px-3 py-1 text-xs ${filtro.has(c) ? 'border-texto bg-texto text-white' : 'border-linea text-tenue'}`}>{c}</button>
            ))}
          </div>
          <label className="orden-comparacion flex items-center gap-2 text-sm text-tenue">
            Ordenar por
            <select value={orden} onChange={(e) => setOrden(e.target.value)} className="rounded-md border border-linea bg-fondo px-2 py-1.5 text-texto">
              <option value="">Orden original</option>
              {FILAS.map((f) => <option key={f.clave} value={f.clave}>{f.texto}</option>)}
            </select>
            <button onClick={() => setAscendente(!ascendente)} disabled={!orden}
              aria-label={ascendente ? 'Orden ascendente' : 'Orden descendente'} className="rounded-md border border-linea p-1.5 text-texto disabled:opacity-40">
              <ArrowDownUp className={`size-4 ${ascendente ? '' : 'rotate-180'}`} />
            </button>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-xs text-apagado">
                <th className="pb-3 font-normal">Indicador</th>
                {columnas.map((x) => <th key={x.id} className="pb-3 text-right text-sm font-semibold text-texto">Ubicación {x.id}</th>)}
              </tr>
            </thead>
            <tbody>
              {!filas.length && <tr><td colSpan={1+columnas.length} className="py-4">Selecciona una categoría para ver sus indicadores.</td></tr>}
              {filas.map((f) => (
                <tr key={f.clave} className="border-t border-linea">
                  <td className="py-2.5 pr-4"><p className="font-semibold">{f.texto}</p><p className="text-xs text-apagado">{f.categoria}. {f.ayuda}</p></td>
                  {columnas.map((x) => <td key={x.id} className={`py-2.5 text-right tabular-nums ${f.clave === orden ? 'font-semibold' : ''}`}>{f.formato(f.valor(x))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Destacados items={[
        {
          cifra: `${razon}×`,
          titulo: `${mas1k.id} tiene ${razon} veces más competencia a 1 km que ${menos1k.id}`,
          texto: `${mas1k.concesionarios_1km} concesionarios frente a ${menos1k.concesionarios_1km}. Es la diferencia más grande entre las tres opciones.`,
        },
        saltoVial ? {
          cifra: `${saltoVial.competidores_ruta_1km} → ${saltoVial.competidores_ruta_2km}`,
          titulo: `${saltoVial.id}: aislada a pie de calle, rodeada a 2 km`,
          texto: `Por calle, ${saltoVial.id} tiene ${saltoVial.competidores_ruta_1km} competidor${saltoVial.competidores_ruta_1km === 1 ? '' : 'es'} a 1 km, pero ${saltoVial.competidores_ruta_2km} a 2 km. La competencia está cerca, aunque no en la cuadra.`,
        } : { cifra: '—', titulo: 'Red vial no disponible', texto: NO_DISPONIBLE },
        directa ? {
          cifra: decimal(directa.indice_rodeo_medio, 2),
          titulo: `${directa.id} tiene los recorridos más directos`,
          texto: `Por cada 100 m en línea recta se recorren ${Math.round((directa.indice_rodeo_medio ?? 0) * 100)} m por calle. En ${rodeosa?.id} son ${Math.round((rodeosa?.indice_rodeo_medio ?? 0) * 100)} m.`,
        } : { cifra: '—', titulo: 'Índice de rodeo no disponible', texto: NO_DISPONIBLE },
      ]} />

      <PorQue items={[
        { cifra: '1 km y 2 km', texto: 'Un radio de 1 km representa la competencia inmediata (a pocos minutos); 2 km, la actividad automotriz de la zona. Contamos solo los 21 concesionarios usados en los modelos, en línea recta.' },
        { cifra: 'Por carretera', texto: 'La línea recta subestima la distancia real. Por eso también medimos la ruta más corta en la red de calles de OpenStreetMap, sin tráfico. Un negocio a 1.5 km en línea recta puede quedar a más de 2 km por calle.' },
        {
          cifra: candidata ? `${candidata.id}: ${candidata.ganadas.length} de ${candidata.total}` : 'Sin candidata',
          texto: candidata
            ? `${candidata.id} es candidata preliminar porque tiene la menor competencia en ${candidata.ganadas.length} de ${candidata.total} medidas (${candidata.ganadas.join(', ')}).${candidata.perdidas.map((p) => ` ${p.id} gana ${p.metricas.join(' y ')}.`).join('')}`
            : 'Ninguna ubicación gana la mayoría de las medidas de competencia, así que no destacamos ninguna.',
        },
        { cifra: 'Misma población', texto: `Las tres están en el distrito de ${u[0].distrito ?? NO_DISPONIBLE} (${entero(u[0].poblacion_2024)} habitantes). El censo no las diferencia; haría falta demanda por colonia o tráfico vehicular.` },
      ]} />

      <SiguienteEtapa actual={3} texto="Vemos cómo K-Means agrupó a los concesionarios en dos zonas." />
    </>
  )
}
