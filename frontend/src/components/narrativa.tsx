import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'

export const PASOS = [
  { a: '/', paso: 1, titulo: 'Resumen del análisis', corto: 'Resumen' },
  { a: '/mapa', paso: 2, titulo: 'Explorar ubicaciones en el mapa', corto: 'Explorar mapa' },
  { a: '/comparacion', paso: 3, titulo: 'Comparación de A, B y C', corto: 'Ubicaciones A/B/C' },
  { a: '/kmeans', paso: 4, titulo: 'Agrupaciones con K-Means', corto: 'Modelo K-Means' },
  { a: '/knn', paso: 5, titulo: 'Clasificación con KNN', corto: 'Clasificación KNN' },
  { a: '/conclusiones', paso: 6, titulo: 'Conclusiones y pendientes', corto: 'Conclusiones' },
] as const

export function Cabecera({ seccion = 'Hotspots / Investigación', titulo, subtitulo, children, antes }: {
  seccion?: ReactNode; titulo: ReactNode; subtitulo?: ReactNode; children?: ReactNode; antes?: ReactNode
}) {
  return (
    <header className="mb-8 border-b border-linea pb-8">
      {antes ?? <p className="text-[11px] font-semibold uppercase tracking-[0.02em] text-tenue">{seccion}</p>}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 md:mt-8">
        <div className="max-w-4xl">
          <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.025em] md:text-[38px]">{titulo}</h1>
          {subtitulo && <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-tenue">{subtitulo}</p>}
        </div>
        {children}
      </div>
    </header>
  )
}

export function EncabezadoEtapa({ titulo, resumen, children }: {
  paso?: number; titulo: string; resumen: ReactNode; children?: ReactNode
}) {
  return <Cabecera titulo={titulo} subtitulo={resumen}>{children}</Cabecera>
}

export function Panel({ children, className = '', as: Etiqueta = 'section' }: {
  children: ReactNode; className?: string; as?: 'section' | 'article' | 'div'
}) {
  return (
    <Etiqueta className={`tarjeta rounded-[13px] bg-superficie p-6 md:p-7 ${className}`}>{children}</Etiqueta>
  )
}

export function Etiqueta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-semibold uppercase tracking-[0.02em] text-tenue ${className}`}>{children}</p>
}

export function PorQue({ titulo = 'Por qué estos datos', items }: {
  titulo?: string; items: { cifra: ReactNode; texto: ReactNode }[]
}) {
  return (
    <Panel className="mt-5">
      <h2 className="text-[20px] font-semibold">{titulo}</h2>
      <dl className="mt-4 divide-y divide-linea">
        {items.map((i, n) => (
          <div key={n} className="grid gap-1 py-3.5 md:grid-cols-[180px_1fr] md:gap-6">
            <dt className="text-[15px] font-semibold tabular-nums">{i.cifra}</dt>
            <dd className="text-sm leading-relaxed text-tenue">{i.texto}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

export function Destacados({ items }: { items: { cifra: ReactNode; titulo: string; texto: ReactNode }[] }) {
  return (
    <section aria-label="Datos destacados" className="mt-5 grid gap-3 md:grid-cols-3">
      {items.map((d) => (
        <div key={d.titulo} className="tarjeta p-6">
          <p className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{d.cifra}</p>
          <p className="mt-3 text-sm font-semibold">{d.titulo}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-tenue">{d.texto}</p>
        </div>
      ))}
    </section>
  )
}

export function Lectura({ mostramos, significa, concluimos }: {
  mostramos: ReactNode; significa: ReactNode; concluimos: ReactNode
}) {
  const partes = [
    { titulo: 'Qué mostramos', texto: mostramos, fuerte: false },
    { titulo: 'Qué significa', texto: significa, fuerte: false },
    { titulo: 'Qué concluimos', texto: concluimos, fuerte: true },
  ]
  return (
    <div className="@container">
      <div className="grid gap-px overflow-hidden rounded-[10px] bg-linea @3xl:grid-cols-3">
        {partes.map(({ titulo, texto, fuerte }) => (
          <div key={titulo} className={`px-4 py-3 ${fuerte ? 'bg-superficie-2' : 'bg-fondo'}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.02em] ${fuerte ? 'text-texto' : 'text-tenue'}`}>{titulo}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-texto">{texto}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Leyenda({ items }: { items: { texto: string; color: string; forma?: 'circulo' | 'rombo' | 'anillo' | 'cuadro' }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-tenue">
      {items.map((i) => <li key={i.texto} className="flex items-center gap-1.5"><Muestra color={i.color} forma={i.forma ?? 'cuadro'} />{i.texto}</li>)}
    </ul>
  )
}

export function Bloque({ titulo, subtitulo, children, lectura, accion, className = '' }: {
  titulo: string; subtitulo?: ReactNode; children: ReactNode; lectura?: ReactNode; accion?: ReactNode; className?: string
}) {
  return (
    <section className={`tarjeta rounded-[13px] bg-superficie ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
        <div>
          <h2 className="text-[18px] font-semibold">{titulo}</h2>
          {subtitulo && <p className="mt-1 max-w-prose text-[13px] text-tenue">{subtitulo}</p>}
        </div>
        {accion}
      </header>
      <div className="px-6 pb-5 pt-4">{children}</div>
      {lectura && <div className="px-4 pb-4">{lectura}</div>}
    </section>
  )
}

export function Seccion({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="mb-5 mt-14 border-t border-linea pt-8">
      <h2 className="text-[22px] font-semibold">{titulo}</h2>
      {texto && <p className="mt-1.5 max-w-[68ch] text-sm text-tenue">{texto}</p>}
    </div>
  )
}

export function SiguienteEtapa({ actual, texto }: { actual: number; texto: string }) {
  const siguiente = PASOS.find((p) => p.paso === actual + 1)
  if (!siguiente) return null
  return (
    <Link to={siguiente.a}
      className="group mt-12 flex items-center justify-between gap-4 rounded-[13px] bg-superficie px-6 py-5 transition-colors hover:bg-superficie-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.02em] text-tenue">Siguiente: {siguiente.corto}</p>
        <p className="mt-1 text-[15px] font-medium text-texto">{texto}</p>
      </div>
      <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}

export function Cifra({ valor, unidad, etiqueta, color }: {
  valor: ReactNode; unidad?: string; etiqueta: string; color?: string
}) {
  return (
    <div>
      <p className="text-xs text-tenue">{etiqueta}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight" style={color ? { color } : undefined}>
        {valor}{unidad && <span className="ml-1 text-sm font-normal text-tenue">{unidad}</span>}
      </p>
    </div>
  )
}

export function Muestra({ color, forma = 'circulo' }: { color: string; forma?: 'circulo' | 'rombo' | 'anillo' | 'cuadro' }) {
  const base = 'inline-block shrink-0'
  if (forma === 'rombo') return <span className={`${base} size-2.5 rotate-45 border-2`} style={{ borderColor: color }} />
  if (forma === 'anillo') return <span className={`${base} size-3 rounded-full border-2`} style={{ borderColor: color }} />
  if (forma === 'cuadro') return <span className={`${base} size-2.5 rounded-[2px]`} style={{ background: color }} />
  return <span className={`${base} size-2.5 rounded-full`} style={{ background: color }} />
}

export function BarraPista({ valor, maximo, color, alto = 15, etiqueta }: {
  valor: number; maximo: number; color: string; alto?: number; etiqueta?: string
}) {
  const ancho = maximo > 0 ? (valor / maximo) * 100 : 0
  return (
    <div className="w-full rounded-full bg-superficie-2" style={{ height: alto }} role="img" aria-label={etiqueta}>
      <div className="h-full rounded-full" style={{ width: `${ancho}%`, background: color }} />
    </div>
  )
}
