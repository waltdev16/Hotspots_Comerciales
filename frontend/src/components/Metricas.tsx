import { useEffect, useRef, useState } from 'react'
import { Store, Layers, MapPin, ScanLine, Flag } from 'lucide-react'
import type { Resumen, Ubicacion } from '../types/api'
import { candidataPreliminar } from '../services/analisis'
import { entero, metros } from '../services/formato'

function Contador({ valor }: { valor: number }) {
  const [n, setN] = useState(valor)
  const ref = useRef<HTMLSpanElement>(null)
  const visto = useRef(false)
  useEffect(() => {
    if (visto.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(valor); return }
    let frame = 0
    const obs = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return
      visto.current = true
      obs.disconnect()
      const inicio = performance.now()
      function animar(t: number) {
        const p = Math.min(1, (t - inicio) / 900)
        setN(Math.round(valor * (1 - (1 - p) ** 3)))
        if (p < 1) frame = requestAnimationFrame(animar)
      }
      frame = requestAnimationFrame(animar)
    })
    obs.observe(ref.current!)
    return () => { obs.disconnect(); cancelAnimationFrame(frame) }
  }, [valor])
  return <span ref={ref} aria-label={entero(valor)}><span aria-hidden>{entero(n)}</span></span>
}

export function Metricas({ resumen: r, ubicaciones, seleccion }: { resumen: Resumen; ubicaciones: Ubicacion[]; seleccion?: Ubicacion }) {
  const candidata = candidataPreliminar(ubicaciones)
  const items = [
    { Icono: Store, valor: r.establecimientos_entrenamiento, titulo: 'Concesionarios analizados', pie: 'De ' + r.establecimientos_analizados + ' registros OSM' },
    { Icono: Layers, valor: r.clusters, titulo: 'Grupos geográficos', pie: 'Agrupamiento K-Means' },
    { Icono: MapPin, valor: r.ubicaciones_propuestas, titulo: 'Ubicaciones propuestas', pie: ubicaciones.map(u => u.id).join(' · ') },
    { Icono: Flag, valor: candidata?.id ?? '—', titulo: 'Candidata preliminar', pie: 'Menor competencia cercana' },
    { Icono: ScanLine, valor: seleccion?.concesionarios_1km ?? '—', titulo: 'Competidores a 1 km', pie: seleccion ? 'Ubicación ' + seleccion.id + ' · línea recta' : 'Sin selección' },
  ]
  return <div className="metricas">{items.map(({Icono, valor, titulo, pie}) => <div className="metrica" key={titulo}>
    <div><span>{titulo}</span><Icono size={17}/></div>
    <strong>{typeof valor === 'number' ? <Contador valor={valor}/> : valor}</strong><small>{pie}</small>
  </div>)}</div>
}

export function Hallazgo({ ubicaciones }: { ubicaciones: Ubicacion[] }) {
  const resultado = candidataPreliminar(ubicaciones)
  const u = ubicaciones.find(x => x.id === resultado?.id)
  return <section className="hallazgo"><div className="seccion-icono"><Flag size={17}/><h2>¿Qué encontramos?</h2></div>
    {u && resultado ? <><p><strong>La ubicación {u.id} tiene menos competencia en {resultado.ganadas.length} de {resultado.total} medidas.</strong> A 1 km en línea recta encontramos {ubicaciones.map(x => x.concesionarios_1km + ' en ' + x.id).join(', ')}.</p>
      <p>El más cercano a {u.id} es {u.establecimiento_mas_cercano}, a {metros(u.distancia_mas_cercano_m)}. Para evaluar la oportunidad comercial todavía necesitamos medir demanda, tráfico y costo del local.</p></> :
    <p>Los indicadores disponibles no identifican una candidata con menor competencia en la mayoría de las medidas.</p>}
  </section>
}
