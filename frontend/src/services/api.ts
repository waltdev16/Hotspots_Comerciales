// Comunicación con la API FastAPI. El frontend no contiene lógica de análisis.
import type { FeatureCollection } from 'geojson'
import type {
  Clusters, Concesionario, Estado, Fuentes, PuntoNuevo, Resumen, Ubicacion,
} from '../types/api'

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export class ErrorApi extends Error {
  estado: number
  constructor(mensaje: string, estado: number) {
    super(mensaje)
    this.estado = estado
  }
}

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', ...(opciones?.headers ?? {}) },
    })
  } catch {
    throw new ErrorApi(`No se pudo conectar con la API en ${API_URL}. Verifique que FastAPI esté en ejecución.`, 0)
  }
  if (!respuesta.ok) {
    let detalle = respuesta.statusText
    try {
      const cuerpo = await respuesta.json()
      detalle = typeof cuerpo.detail === 'string'
        ? cuerpo.detail
        : Array.isArray(cuerpo.detail) ? cuerpo.detail.map((d: { msg: string }) => d.msg).join('; ') : detalle
    } catch { /* respuesta sin JSON */ }
    throw new ErrorApi(detalle, respuesta.status)
  }
  return respuesta.json() as Promise<T>
}

export const api = {
  estado: () => pedir<Estado>('/api/estado'),
  resumen: () => pedir<Resumen>('/api/resumen'),
  concesionarios: () => pedir<{ total: number; registros: Concesionario[] }>('/api/concesionarios'),
  clusters: () => pedir<Clusters>('/api/clusters'),
  ubicaciones: () => pedir<Ubicacion[]>('/api/ubicaciones'),
  fuentes: () => pedir<Fuentes>('/api/fuentes'),
  geo: (capa: 'limites' | 'red-vial' | 'area-estudio') => pedir<FeatureCollection>(`/api/geo/${capa}`),
  analizar: (latitud: number, longitud: number, nombre?: string) =>
    pedir<PuntoNuevo>('/api/analizar-ubicacion', {
      method: 'POST', body: JSON.stringify({ latitud, longitud, nombre }),
    }),
  descarga: (archivo: string) => `${API_URL}/api/descargas/${encodeURIComponent(archivo)}`,
}
