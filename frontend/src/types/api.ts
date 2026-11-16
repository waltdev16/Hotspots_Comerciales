// Tipos de las respuestas de la API FastAPI.

export interface Estado {
  api: string
  cargado_en: string
  fecha_calculo_modelo: string | null
  modelo_knn: boolean
  limites_opamss: boolean
  red_vial: boolean
  archivos: Record<string, boolean>
  avisos: string[]
}

export interface UbicacionBreve {
  id: string
  nombre: string
  zona_knn: string
  distrito: string | null
  concesionarios_1km: number
  competidor_vial_mas_cercano_m: number | null
}

export interface Resumen {
  establecimientos_analizados: number
  establecimientos_entrenamiento: number
  excluidos_confirmados: number
  pendientes_revision: number
  perifericos: number
  clusters: number
  silhouette: number
  knn_k: number
  acuerdo_knn_kmeans: number
  ubicaciones_propuestas: number
  poblacion: {
    distrito_san_salvador: number
    municipio_san_salvador_centro: number
    departamento_san_salvador: number
    anio: number
    fuente: string
  }
  fecha_extraccion_osm: string | null
  fecha_calculo: string | null
  red_vial: string | null
  ubicaciones: UbicacionBreve[]
  advertencias: string[]
}

export interface Concesionario {
  osm_id: string
  name: string | null
  category: string | null
  brand: string | null
  street: string | null
  latitude: number
  longitude: number
  estado: 'sin_alerta' | 'pendiente_revision' | 'excluido_confirmado'
  motivo: string | null
  fuente_verificacion: string | null
  zona: string | null
  usado_entrenamiento: boolean
  detalle_dataset: string
}

export interface Centroide {
  zona: string
  latitude: number
  longitude: number
  count: number
  radio_medio_m: number
  radio_max_m: number
}

export interface Clusters {
  k: number
  criterio: string
  semilla: number
  silhouette: number
  evaluacion_kmeans: { k: number; silhouette: number; inercia: number; min_cluster_size: number }[]
  knn_k: number
  evaluacion_knn: { k: number; acuerdo_loo: number }[]
  acuerdo_loo: number
  estabilidad_knn: Record<string, Record<string, string>>
  grupos: (Centroide & {
    miembros: { osm_id: string; name: string; latitude: number; longitude: number; x_m: number; y_m: number }[]
  })[]
  advertencias: string[]
}

export interface Vecino {
  osm_id: string
  name: string
  zona: string
  distance_m: number
  latitude?: number
  longitude?: number
}

export interface Ruta {
  osm_id: string
  competidor: string
  distancia_vial_m: number | null
  distancia_recta_m: number
  estado_ruta: string
}

export interface AnalisisPunto {
  nombre: string
  latitude: number
  longitude: number
  zona_knn: string
  proporcion_vecinos_zona: number
  dentro_area_estudio: boolean
  concesionarios_500m: number
  concesionarios_1km: number
  concesionarios_2km: number
  distancia_mas_cercano_m: number
  distancia_tercer_vecino_m: number
  establecimiento_mas_cercano: string
  vecinos_knn: Vecino[]
  distrito: string | null
  municipio: string | null
  departamento?: string | null
  poblacion_2024: number | null
  fuente_distrito: string
  nota_poblacion: string
  estado_red: string
  competidores_con_ruta: number
  competidores_ruta_1km: number | null
  competidores_ruta_2km: number | null
  competidor_vial_mas_cercano: string | null
  competidor_vial_mas_cercano_m: number | null
  indice_rodeo_medio: number | null
  rutas_cercanas: Ruta[]
  avisos?: string[]
}

export interface Ubicacion extends AnalisisPunto {
  id: string
}

export interface PuntoNuevo extends AnalisisPunto {
  avisos: string[]
}

export interface Fuente {
  id: string
  dato: string
  valor: string
  unidad: string
  fecha_dato: string
  cobertura: string
  tipo: string
  fuente: string
  url: string | null
  fecha_consulta: string
  metodo: string
  limitaciones: string
}

export interface Indicador {
  id: string
  indicador: string
  valor: number
  unidad: string
  fecha_dato: string
  cobertura: string
  tipo: string
  fuente_id: string
  nota: string
}

export interface FilaCenso {
  codigo_distrito: string | null
  departamento: string
  municipio: string
  distrito: string
  poblacion_2024: number
  fuente_id: string
}

export interface Fuentes {
  fuentes: Fuente[]
  indicadores: Indicador[]
  censo: FilaCenso[]
  limitaciones: string[]
  descargas: string[]
}
