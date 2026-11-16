import type { ReactNode } from 'react'
import { AlertTriangle, Info, Loader2, RefreshCw } from 'lucide-react'

export function Tarjeta({ titulo, descripcion, children, className = '', accion }: {
  titulo?: string; descripcion?: ReactNode; children: ReactNode; className?: string; accion?: ReactNode
}) {
  return (
    <section className={`tarjeta rounded-[13px] bg-superficie p-5 ${className}`}>
      {(titulo || accion) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {titulo && <h2 className="text-base font-semibold text-texto">{titulo}</h2>}
            {descripcion && <p className="mt-1 max-w-prose text-sm text-tenue">{descripcion}</p>}
          </div>
          {accion}
        </header>
      )}
      {children}
    </section>
  )
}

export function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode }) {
  return (
    <div className="tarjeta rounded-[13px] bg-superficie px-5 py-4">
      <p className="text-sm text-tenue">{etiqueta}</p>
      <p className="mt-1 font-titulo text-3xl font-semibold tracking-tight text-texto">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-apagado">{detalle}</p>}
    </div>
  )
}

export function Campo({ titulo, valor, ayuda }: { titulo: string; valor: ReactNode; ayuda?: string }) {
  return (
    <div className="py-2">
      <dt className="text-sm font-semibold text-texto">{titulo}</dt>
      <dd className="mt-0.5 text-sm text-texto/90">{valor}</dd>
      {ayuda && <dd className="mt-0.5 text-xs leading-relaxed text-apagado">{ayuda}</dd>}
    </div>
  )
}

const ESTILO_TIPO: Record<string, string> = {
  observado: 'border-[#6f8f86] text-[#4d6b62]',
  derivado: 'border-grafito text-grafito',
  supuesto: 'border-aviso/60 text-aviso',
}

export function TipoDato({ tipo }: { tipo: string }) {
  const clave = tipo.split(' ')[0]
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${ESTILO_TIPO[clave] ?? 'border-linea text-tenue'}`}>
      {clave}
    </span>
  )
}

export function Cargando({ texto = 'Cargando datos de la API' }: { texto?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-tenue" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {texto}
    </div>
  )
}

export function ErrorCarga({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl border border-negativo/40 bg-superficie p-4 text-sm" role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-negativo" aria-hidden />
      <div className="flex-1">
        <p className="font-semibold">No se pudieron cargar los datos</p>
        <p className="mt-1 text-tenue">{mensaje}</p>
      </div>
      {reintentar && (
        <button onClick={reintentar} className="inline-flex items-center gap-1.5 rounded-lg border border-linea px-3 py-1.5 hover:bg-superficie-2">
          <RefreshCw className="size-3.5" aria-hidden /> Reintentar
        </button>
      )}
    </div>
  )
}

export function Nota({ children, tipo = 'info' }: { children: ReactNode; tipo?: 'info' | 'aviso' }) {
  const Icono = tipo === 'aviso' ? AlertTriangle : Info
  return (
    <div className={`flex gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${
      tipo === 'aviso' ? 'border-aviso/40 bg-aviso/5 text-texto/90' : 'border-linea bg-superficie-2/60 text-tenue'}`}>
      <Icono className={`mt-0.5 size-4 shrink-0 ${tipo === 'aviso' ? 'text-aviso' : 'text-tenue'}`} aria-hidden />
      <div>{children}</div>
    </div>
  )
}

export function EncabezadoPagina({ titulo, descripcion, children }: { titulo: string; descripcion: string; children?: ReactNode }) {
  return (
    <header className="mb-8 border-b border-linea pb-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.02em] text-tenue">Hotspots / Investigación</p>
      <h1 className="mt-6 text-[30px] font-semibold leading-[1.15] tracking-[-0.025em] md:mt-8 md:text-[38px]">{titulo}</h1>
      <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-tenue">{descripcion}</p>
      {children && <div className="mt-6">{children}</div>}
    </header>
  )
}

export function Selector<T extends string>({ opciones, valor, onChange, etiqueta }: {
  opciones: { valor: T; texto: string }[]; valor: T; onChange: (v: T) => void; etiqueta: string
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex flex-wrap gap-2">
      {opciones.map((o) => (
        <button key={o.valor} role="radio" aria-checked={valor === o.valor} onClick={() => onChange(o.valor)}
          className={`rounded-full px-[14px] py-[7px] text-xs font-medium transition-colors ${
            valor === o.valor ? 'bg-texto text-white' : 'bg-[#d9d9d9] text-texto hover:bg-[#cdcdcd]'}`}>
          {o.texto}
        </button>
      ))}
    </div>
  )
}

export function TooltipGrafico({ active, payload, label, formato }: {
  active?: boolean
  payload?: { name?: string; value?: number | string; color?: string; dataKey?: string | number }[]
  label?: string | number
  formato?: (v: number, clave?: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-linea bg-superficie px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 font-semibold text-texto">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-tenue">
          <span className="inline-block size-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 text-texto">
            {typeof p.value === 'number' && formato ? formato(p.value, String(p.dataKey)) : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}
