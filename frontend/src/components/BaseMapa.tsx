import { useEffect, useState } from 'react'
import { ImageOverlay, TileLayer, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

const region = L.latLngBounds([13.40,-89.56],[14.14,-88.88])
const ciudad = L.latLngBounds([13.59,-89.36],[13.82,-89.06])
const clave = (import.meta.env.CARTO_BASEMAP_KEY ?? '').trim()
const teselas = clave
  ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=' + encodeURIComponent(clave)
  : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export default function BaseMapa() {
  const [, refrescar] = useState(0)
  const mapa = useMapEvents({moveend: () => refrescar(n => n+1), resize: () => refrescar(n => n+1)})
  const [fallo, setFallo] = useState(false)
  const remoto = clave || mapa.getZoom() > 15 || !region.contains(mapa.getBounds())
  useEffect(() => {
  if (!document.fullscreenEnabled) return

  const contenedor = mapa.getContainer()
  const control = new L.Control({ position: 'topleft' })
  const boton = document.createElement('button')

  function actualizar() {
    const activo = document.fullscreenElement === contenedor
    boton.textContent = activo ? 'Salir de pantalla completa' : 'Pantalla completa'
    boton.setAttribute('aria-pressed', String(activo))
    requestAnimationFrame(() => mapa.invalidateSize({ pan: false }))
  }

  boton.type = 'button'
  boton.className = 'boton'
  boton.onclick = async () => {
    try {
      if (document.fullscreenElement === contenedor) {
        await document.exitFullscreen()
      } else {
        await contenedor.requestFullscreen()
      }
    } catch {
      boton.textContent = 'Reintentar pantalla completa'
    }
  }

  control.onAdd = () => {
    const caja = L.DomUtil.create('div', 'control-pantalla')
    caja.appendChild(boton)
    L.DomEvent.disableClickPropagation(caja)
    return caja
  }

  control.addTo(mapa)
  actualizar()
  document.addEventListener('fullscreenchange', actualizar)

  return () => {
    document.removeEventListener('fullscreenchange', actualizar)
    control.remove()
  }
}, [mapa])
  return <>
    <ImageOverlay url="/cartografia/region.webp" bounds={region} pane="tilePane" zIndex={1} interactive={false}/>
    <ImageOverlay url="/cartografia/ciudad.webp" bounds={ciudad} pane="tilePane" zIndex={2} interactive={false}
      attribution='<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · Geofabrik'/>
    {remoto && !fallo && <TileLayer url={teselas} zIndex={3} maxNativeZoom={19} maxZoom={20}
      attribution={clave ? '© CARTO' : ''} eventHandlers={{tileerror: () => setFallo(true)}}/>}
  </>
}
