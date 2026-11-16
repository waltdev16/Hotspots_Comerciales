import { useState } from 'react'
import { useMapEvents } from 'react-leaflet'
import L from 'leaflet'

type Origen = { latitude: number; longitude: number }

function marcas(min: number, max: number, cantidad: number) {
  const ideal = (max-min)/cantidad
  if (!Number.isFinite(ideal) || ideal <= 0) return []
  const potencia = 10 ** Math.floor(Math.log10(ideal))
  const paso = ([1,2,2.5,5,10].find(n => n*potencia >= ideal) ?? 10)*potencia
  const primero = Math.ceil(min/paso)
  const ultimo = Math.floor(max/paso)
  return Array.from({length:Math.max(0,ultimo-primero+1)}, (_,i) => (primero+i)*paso)
}

export default function Ejes({ origen }: { origen?: Origen }) {
  const [,refrescar] = useState(0)
  const actualizar = () => refrescar(n => n+1)
  const mapa = useMapEvents({move:actualizar,zoom:actualizar,resize:actualizar})
  const {x:w,y:h} = mapa.getSize()
  if (w < 20 || h < 20) return null
  const borde = mapa.getBounds()
  const lon = origen?.longitude ?? 0, lat = origen?.latitude ?? 0
  const mx = origen ? L.latLng(lat, lon).distanceTo([lat, lon + .001]) * 1000 : 1
  const my = origen ? L.latLng(lat, lon).distanceTo([lat + .001, lon]) * 1000 : 1
  const xs = marcas((borde.getWest()-lon)*mx,(borde.getEast()-lon)*mx,Math.max(2,w/105))
  const ys = marcas((borde.getSouth()-lat)*my,(borde.getNorth()-lat)*my,Math.max(2,h/65))
  const fmt = (n:number) => origen ? n.toLocaleString('es-SV',{maximumFractionDigits:1}) : n.toFixed(mapa.getZoom()>16 ? 5 : 3)+'°'
  return <svg className="plano-ejes" width={w} height={h} aria-hidden="true">
    {xs.map(v => {
      const x=mapa.latLngToContainerPoint([lat,lon+v/mx]).x
      return <g key={v}><line className={v===0 ? 'origen' : ''} x1={x} x2={x} y1={0} y2={h-26}/>
        {x>58 && x<w-23 && <text x={x} y={h-7} textAnchor="middle">{fmt(v)}</text>}</g>
    })}
    {ys.map(v => {
      const y=mapa.latLngToContainerPoint([lat+v/my,lon]).y
      return <g key={v}><line className={v===0 ? 'origen' : ''} x1={0} x2={w} y1={y} y2={y}/>
        {y>29 && y<h-31 && <text x="5" y={y-5}>{fmt(v)}</text>}</g>
    })}
    <path d={`M 2 4 V ${h-25} H ${w-3}`}/>
  </svg>
}
