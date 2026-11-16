import { useState } from 'react'
import type { Ubicacion } from '../types/api'
import { Panel } from './narrativa'

export default function Radios({ ubicaciones }: {ubicaciones: Ubicacion[]}) {
  const [detalle,setDetalle] = useState('')
  const max = Math.max(1,...ubicaciones.flatMap(u => [u.concesionarios_1km,u.concesionarios_2km]))
  return <Panel><div className="titulo-bloque"><div><p className="etiqueta">Competencia en línea recta</p><h2>Establecimientos cercanos por radio</h2></div></div>
    <div className="radios">{ubicaciones.map(u => <div className="fila-radio" key={u.id}>
      <b>Ubicación {u.id}</b><div>{([1,2] as const).map(r => {
        const n = r === 1 ? u.concesionarios_1km : u.concesionarios_2km
        const info = 'Ubicación ' + u.id + ' — Radio de ' + r + ' km. Hay ' + n + ' concesionarios registrados dentro de ese radio en línea recta.'
        return <button key={r} className={'barra-radio radio-' + r} title={info} aria-label={info} onClick={() => setDetalle(info)}
          onFocus={() => setDetalle(info)} onMouseEnter={() => setDetalle(info)}>
          <span>{r} km</span><i><em style={{width:(100*n/max) + '%'}}/></i><strong>{n}</strong></button>
      })}</div></div>)}</div>
    <p className="nota-radio" aria-live="polite">{detalle || 'Todas las barras usan la misma escala, de 0 a ' + max + ' concesionarios.'}</p>
    <small>Una menor concentración de competidores no garantiza mayor demanda.</small></Panel>
}
