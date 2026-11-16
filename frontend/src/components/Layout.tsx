import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Menu, X, PanelLeftClose, PanelLeftOpen, MapPinned, LayoutDashboard, Map, Layers, Network, ChartColumn, Flag, Database, MapPin } from 'lucide-react'
import { PASOS } from './narrativa'
import Modal from './Modal'

const paginas = [...PASOS, { a: '/datos', corto: 'Datos y metodología' }]
const iconos = [LayoutDashboard, Map, ChartColumn, Layers, Network, Flag, Database]

export default function Layout() {
  const [menu, setMenu] = useState(false)
  const [corta, setCorta] = useState(() => { try { return localStorage.getItem('hotspots.sidebar') === 'compacta' } catch { return false } })
  const { pathname } = useLocation()
  function contraer() {
    setCorta(!corta)
    try { localStorage.setItem('hotspots.sidebar', corta ? 'amplia' : 'compacta') } catch { /* Almacenamiento opcional. */ }
  }
  const nombre = paginas.find(p => p.a === pathname)?.corto ?? 'Análisis'
  const navegacion = <nav aria-label="Secciones del análisis">{paginas.map((p, i) => {
    const Icono = iconos[i]
    return <NavLink key={p.a} to={p.a} end title={p.corto} aria-label={p.corto} onClick={() => setMenu(false)}>
      <Icono size={18}/><span>{p.corto}</span>
    </NavLink>
  })}</nav>
  const marca = <div className="marca"><i><MapPinned size={22}/></i><div><strong>Hotspots</strong><small>COMERCIALES</small></div></div>
  return <div className={'shell ' + (corta ? 'compacta' : '')}>
    <aside className="barra">{marca}{navegacion}
      <footer><button title={corta ? 'Expandir menú' : 'Contraer menú'} aria-expanded={!corta} onClick={contraer}>
        {corta ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}<span>Contraer menú</span></button>
        <div className="equipo"><b>TH</b><span>Team Habibolu<small>Proyecto académico</small></span></div>
      </footer>
    </aside>
    <div className="principal"><header className="topbar">
      <button className="boton movil" onClick={() => setMenu(true)} aria-label="Abrir menú"><Menu size={19}/></button>
      <div className="miga"><MapPin size={15}/> San Salvador <span>/</span> <strong>{nombre}</strong></div>
    </header><main key={pathname} className="contenido aparecer"><Outlet/></main></div>
    {menu && <Modal titulo="Menú de navegación" clase="menu-movil" cerrar={() => setMenu(false)}>{marca}<button className="cerrar-menu" onClick={() => setMenu(false)} aria-label="Cerrar menú"><X/></button>{navegacion}</Modal>}
  </div>
}
