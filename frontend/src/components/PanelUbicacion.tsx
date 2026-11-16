import { useState } from 'react'
import { X } from 'lucide-react'
import type { AnalisisPunto } from '../types/api'
import { Campo, Nota } from './ui'
import { Muestra } from './narrativa'
import { colorZona } from '../services/colores'
import { decimal, entero, metros, NO_DISPONIBLE, pct } from '../services/formato'

type Pestana = 'general' | 'competencia'

export default function PanelUbicacion({ punto, titulo, avisos, onCerrar }: {
  punto: AnalisisPunto
  titulo: string
  avisos?: string[]
  onCerrar: () => void
}) {
  const [pestana, setPestana] = useState<Pestana>('general')
  const pestanas: { id: Pestana; texto: string }[] = [
    { id: 'general', texto: 'Información general' },
    { id: 'competencia', texto: 'Competencia' },
  ]

  return (
    <aside className="flex max-h-full flex-col overflow-hidden rounded-[13px] border-t border-linea bg-superficie/95 shadow-2xl backdrop-blur"
      aria-label={`Detalle de ${titulo}`}>
      <header className="flex items-start justify-between gap-3 border-b border-linea px-4 pb-3 pt-4">
        <div>
          <h2 className="text-lg font-semibold leading-tight">{titulo}</h2>
          <p className="mt-0.5 text-xs text-apagado">
            {punto.latitude.toFixed(5)}, {punto.longitude.toFixed(5)}
          </p>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar panel" className="rounded-md p-1 text-tenue hover:bg-superficie-2 hover:text-texto">
          <X className="size-4" />
        </button>
      </header>

      <div role="tablist" className="flex gap-1 border-b border-linea px-3 pt-2">
        {pestanas.map((p) => (
          <button key={p.id} role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)}
            className={`-mb-px border-b-2 px-2.5 pb-2 text-sm ${
              pestana === p.id ? 'border-acento text-texto' : 'border-transparent text-tenue hover:text-texto'}`}>
            {p.texto}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto px-4 py-3">
        {avisos && avisos.length > 0 && (
          <div className="mb-3 space-y-2">{avisos.map((a) => <Nota key={a} tipo="aviso">{a}</Nota>)}</div>
        )}

        {pestana === 'general' && (
          <dl className="divide-y divide-linea/60">
            <Campo titulo="Distrito" valor={punto.distrito ?? NO_DISPONIBLE}
              ayuda={punto.distrito ? `${punto.municipio ?? ''}. ${punto.fuente_distrito}` : punto.fuente_distrito} />
            <Campo titulo="Población del distrito (2024)" valor={punto.poblacion_2024 ? `${entero(punto.poblacion_2024)} habitantes` : NO_DISPONIBLE}
              ayuda="Población residente de todo el distrito según el Censo 2024. No son compradores potenciales." />
            <Campo titulo="Zona KNN" valor={<span className="inline-flex items-center gap-2"><Muestra color={colorZona(punto.zona_knn)} />{punto.zona_knn} ({pct(punto.proporcion_vecinos_zona * 100, 0)} de los vecinos)</span>}
              ayuda={punto.dentro_area_estudio
                ? 'Zona asignada por los 3 concesionarios más cercanos. Es una clasificación geográfica, no una predicción de ventas.'
                : 'Fuera del área de estudio: KNN extrapola y la zona no es confiable.'} />
            <Campo titulo="Distancia al tercer vecino KNN" valor={metros(punto.distancia_tercer_vecino_m)}
              ayuda="Distancia en línea recta al vecino más lejano usado por KNN." />
          </dl>
        )}
        {pestana === 'general' && punto.vecinos_knn.length > 0 && (
          <div className="mt-2 rounded-lg bg-superficie-2/60 p-3">
            <p className="text-xs font-semibold text-tenue">Vecinos más cercanos que definen la zona</p>
            <ol className="mt-1.5 space-y-1 text-sm">
              {punto.vecinos_knn.map((v) => (
                <li key={v.osm_id} className="flex items-center gap-2">
                  <Muestra color={colorZona(v.zona)} /><span className="min-w-0 flex-1 truncate">{v.name}</span>
                  <span className="shrink-0 text-tenue">{metros(v.distance_m)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {pestana === 'competencia' && (
          <>
            <dl className="divide-y divide-linea/60">
              <Campo titulo="Establecimientos cercanos (línea recta)"
                valor={`${punto.concesionarios_500m} a 500 m, ${punto.concesionarios_1km} a 1 km y ${punto.concesionarios_2km} a 2 km`}
                ayuda="Concesionarios OSM usados en el entrenamiento. Indican oferta registrada, no demanda." />
              <Campo titulo="Competidor más cercano (línea recta)"
                valor={`${punto.establecimiento_mas_cercano}, ${metros(punto.distancia_mas_cercano_m)}`} />
              <Campo titulo="Competidor más cercano por calles"
                valor={punto.competidor_vial_mas_cercano
                  ? `${punto.competidor_vial_mas_cercano}, ${metros(punto.competidor_vial_mas_cercano_m)}` : NO_DISPONIBLE}
                ayuda="Ruta más corta en la red vial de OSM, sin tráfico. No se convierte a tiempo." />
              <Campo titulo="Accesibilidad vial"
                valor={punto.estado_red === 'ok'
                  ? `${punto.competidores_ruta_1km} competidores a 1 km y ${punto.competidores_ruta_2km} a 2 km por calle`
                  : NO_DISPONIBLE}
                ayuda={punto.estado_red === 'ok'
                  ? `Índice de rodeo mediano: ${decimal(punto.indice_rodeo_medio, 2)} (distancia por calle ÷ línea recta).`
                  : 'El punto está fuera de la red vial descargada.'} />
            </dl>
            {punto.rutas_cercanas.length > 0 && (
              <table className="mt-3 w-full text-left text-xs">
                <caption className="mb-1 text-left text-xs font-semibold text-texto">Competidores más cercanos por calle</caption>
                <thead className="text-apagado">
                  <tr><th className="py-1 font-normal">Establecimiento</th><th className="py-1 text-right font-normal">Por calle</th><th className="py-1 text-right font-normal">Recta</th></tr>
                </thead>
                <tbody>
                  {punto.rutas_cercanas.slice(0, 6).map((r) => (
                    <tr key={r.osm_id} className="border-t border-linea/60">
                      <td className="py-1.5 pr-2">{r.competidor}</td>
                      <td className="py-1.5 text-right">{metros(r.distancia_vial_m)}</td>
                      <td className="py-1.5 text-right text-tenue">{metros(r.distancia_recta_m)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

      </div>
    </aside>
  )
}
