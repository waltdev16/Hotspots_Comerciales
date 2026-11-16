// Comparaciones sencillas entre los resultados que entrega la API.
// No recalcula modelos: solo ordena y resume valores ya calculados en el backend.
import type { Ubicacion } from '../types/api'

export interface MetricaCompetencia {
  clave: keyof Ubicacion
  texto: string
  tipo: 'recta' | 'calle'
}

// Métricas de concentración de competencia usadas para el criterio preliminar.
export const METRICAS_COMPETENCIA: MetricaCompetencia[] = [
  { clave: 'concesionarios_500m', texto: 'a 500 m en línea recta', tipo: 'recta' },
  { clave: 'concesionarios_1km', texto: 'a 1 km en línea recta', tipo: 'recta' },
  { clave: 'concesionarios_2km', texto: 'a 2 km en línea recta', tipo: 'recta' },
  { clave: 'competidores_ruta_1km', texto: 'a 1 km por calle', tipo: 'calle' },
  { clave: 'competidores_ruta_2km', texto: 'a 2 km por calle', tipo: 'calle' },
]

const valor = (u: Ubicacion, c: keyof Ubicacion) => {
  const v = u[c]
  return typeof v === 'number' ? v : null
}

export function minimos(lista: Ubicacion[], c: keyof Ubicacion): string[] {
  const vals = lista.map((u) => valor(u, c)).filter((v): v is number => v !== null)
  if (!vals.length) return []
  const m = Math.min(...vals)
  return lista.filter((u) => valor(u, c) === m).map((u) => u.id)
}

export interface Candidata {
  id: string
  ganadas: string[]
  total: number
  perdidas: { id: string; metricas: string[] }[]
}

export function candidataPreliminar(lista: Ubicacion[]): Candidata | null {
  const disponibles = METRICAS_COMPETENCIA.filter((m) => lista.every((u) => valor(u, m.clave) !== null))
  if (lista.length < 2 || disponibles.length < 3) return null
  const conteo = new Map<string, string[]>()
  for (const m of disponibles) {
    const ids = minimos(lista, m.clave)
    if (ids.length === 1) conteo.set(ids[0], [...(conteo.get(ids[0]) ?? []), m.texto])
  }
  const orden = [...conteo.entries()].sort((a, b) => b[1].length - a[1].length)
  if (!orden.length) return null
  const [id, ganadas] = orden[0]
  if (ganadas.length <= disponibles.length / 2) return null
  return {
    id, ganadas, total: disponibles.length,
    perdidas: orden.slice(1).map(([otro, m]) => ({ id: otro, metricas: m })),
  }
}

export const maximo = (lista: Ubicacion[], c: keyof Ubicacion) =>
  Math.max(0, ...lista.map((u) => valor(u, c) ?? 0))

export const competidorMasProximo = (lista: Ubicacion[]) =>
  [...lista].sort((a, b) => a.distancia_mas_cercano_m - b.distancia_mas_cercano_m)[0]
