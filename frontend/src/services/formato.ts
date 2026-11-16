// Formatos de números para la interfaz.
export const NO_DISPONIBLE = 'No disponible'

const vacio = (v: number | null | undefined): v is null | undefined =>
  v === null || v === undefined || Number.isNaN(v)

export const entero = (v: number | null | undefined) =>
  vacio(v) ? NO_DISPONIBLE : Math.round(v).toLocaleString('es-SV')

export const pct = (v: number | null | undefined, decimales = 1) =>
  vacio(v) ? NO_DISPONIBLE : `${v.toLocaleString('es-SV', { maximumFractionDigits: decimales, minimumFractionDigits: decimales })} %`

export const metros = (v: number | null | undefined) => {
  if (vacio(v)) return NO_DISPONIBLE
  return v >= 1000 ? `${(v / 1000).toLocaleString('es-SV', { maximumFractionDigits: 2 })} km` : `${Math.round(v)} m`
}

export const decimal = (v: number | null | undefined, d = 3) =>
  vacio(v) ? NO_DISPONIBLE : v.toLocaleString('es-SV', { maximumFractionDigits: d, minimumFractionDigits: d })

export const fecha = (iso: string | null | undefined) => {
  if (!iso) return NO_DISPONIBLE
  const f = new Date(iso)
  return Number.isNaN(f.getTime()) ? iso : f.toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' })
}

export const letra = (id: string) => id.toUpperCase()
