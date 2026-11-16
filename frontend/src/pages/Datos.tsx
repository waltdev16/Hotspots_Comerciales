import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Download, ExternalLink } from 'lucide-react'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import type { Concesionario } from '../types/api'
import { Cargando, EncabezadoPagina, ErrorCarga, Nota, Selector, Tarjeta, TipoDato } from '../components/ui'
import { entero } from '../services/formato'

type Seccion = 'establecimientos' | 'indicadores' | 'censo' | 'fuentes' | 'descargas' | 'kmeans' | 'knn' | 'limites'
const ESTADOS: Record<Concesionario['estado'], string> = {
  sin_alerta: 'Sin alerta', pendiente_revision: 'Pendiente de revisión', excluido_confirmado: 'Excluido',
}

export default function Datos() {
  const fuentes = useApi(api.fuentes)
  const est = useApi(api.concesionarios)
  const [seccion, setSeccion] = useState<Seccion>('establecimientos')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | Concesionario['estado']>('todos')
  const [busqueda, setBusqueda] = useState('')

  const [orden, setOrden] = useState('name')
  const [desc, setDesc] = useState(false)
  const [pagina, setPagina] = useState(0)
  const porPagina = 8
  const registros = useMemo(() => (est.datos?.registros ?? []).filter((r) =>
    (filtroEstado === 'todos' || r.estado === filtroEstado) &&
    (r.name ?? '').toLowerCase().includes(busqueda.toLowerCase())).sort((a,b) => {
    const k = orden as 'name' | 'estado' | 'zona'
    return (desc ? -1 : 1) * (a[k] ?? '').localeCompare(b[k] ?? '', 'es')
  }), [est.datos, filtroEstado, busqueda, orden, desc])
  const paginas = Math.max(1, Math.ceil(registros.length/porPagina))
  const actual = Math.min(pagina, paginas-1)
  function exportar() {
    const campos = ['osm_id','name','estado','zona','latitude','longitude','detalle_dataset','motivo'] as const
    const csv = [campos, ...registros.map(r => campos.map(k => r[k]))].map(fila => fila.map(v => '"' + String(v ?? '').replaceAll('"','""') + '"').join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}))
    const a = document.createElement('a'); a.href=url; a.download='concesionarios_filtrados.csv'; a.click()
    setTimeout(() => URL.revokeObjectURL(url),1000)
  }

  if (fuentes.cargando || est.cargando) return <Cargando />
  if (fuentes.error || !fuentes.datos) return <ErrorCarga mensaje={fuentes.error ?? 'Sin datos'} reintentar={fuentes.reintentar} />
  const f = fuentes.datos

  return (
    <>
      <EncabezadoPagina titulo="Datos y metodología"
        descripcion="Cada cifra indica si es observada (de una fuente verificable), derivada (calculada a partir de datos observados).">
        <Selector etiqueta="Sección" valor={seccion} onChange={setSeccion} opciones={[
          { valor: 'establecimientos', texto: 'Establecimientos' }, { valor: 'indicadores', texto: 'Indicadores' },
          { valor: 'censo', texto: 'Censo 2024' }, { valor: 'fuentes', texto: 'Fuentes' }, { valor: 'kmeans', texto: 'Metodología K-Means' }, { valor: 'knn', texto: 'Metodología KNN' }, { valor: 'limites', texto: 'Limitaciones' }, { valor: 'descargas', texto: 'Descargas' },
        ]} />
      </EncabezadoPagina>

      {seccion === 'establecimientos' && (
        <Tarjeta titulo="Establecimientos de OpenStreetMap"
          descripcion="Auditoría de cada registro: qué se usó en K-Means y por qué se excluyó el resto. Un registro sin alerta no está verificado externamente."
          accion={<TipoDato tipo="observado" />}>
          {est.error && <ErrorCarga mensaje={est.error} reintentar={est.reintentar} />}
          <div className="mb-3 flex flex-wrap gap-2">
            <input value={busqueda} onChange={(e) => {setBusqueda(e.target.value); setPagina(0)}} placeholder="Buscar por nombre" aria-label="Buscar por nombre"
              className="rounded-md border border-linea bg-fondo px-3 py-1.5 text-sm" />
            <select value={filtroEstado} onChange={(e) => {setFiltroEstado(e.target.value as typeof filtroEstado); setPagina(0)}} aria-label="Filtrar por estado"
              className="rounded-md border border-linea bg-fondo px-2 py-1.5 text-sm">
              <option value="todos">Todos los estados</option>
              {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select aria-label="Ordenar concesionarios" className="boton" value={orden} onChange={e => {setOrden(e.target.value); setPagina(0)}}>
              <option value="name">Por nombre</option><option value="zona">Por zona</option><option value="estado">Por estado</option></select>
            <button className="boton" onClick={() => {setDesc(!desc); setPagina(0)}}>{desc ? 'Descendente' : 'Ascendente'}</button>
            <button className="boton" disabled={!registros.length} onClick={exportar}><Download size={15}/> Exportar CSV</button>
            <span className="self-center text-sm text-tenue">{registros.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-apagado">
                <tr><th className="pb-2 font-normal">Nombre</th><th className="pb-2 font-normal">Estado</th><th className="pb-2 font-normal">Zona</th>
                  <th className="pb-2 font-normal">Uso en el modelo</th><th className="pb-2 font-normal">Motivo</th><th className="pb-2 font-normal">OSM</th></tr>
              </thead>
              <tbody>
                {registros.slice(actual*porPagina,(actual+1)*porPagina).map((r) => (
                  <tr key={r.osm_id} className="border-t border-linea">
                    <td className="py-2">{r.name ?? 'Sin nombre'}</td>
                    <td className="py-2">{ESTADOS[r.estado]}</td>
                    <td className="py-2">{r.zona ?? '—'}</td>
                    <td className="py-2">{r.detalle_dataset}</td>
                    <td className="py-2 text-tenue">{r.motivo ?? ''}</td>
                    <td className="py-2"><a className="text-texto hover:underline" target="_blank" rel="noreferrer"
                      href={`https://www.openstreetmap.org/${r.osm_id}`}>{r.osm_id}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!registros.length && <p role="status">Ningún registro coincide con los filtros.</p>}
          <div className="paginacion"><button className="boton" disabled={!actual} onClick={() => setPagina(actual-1)}>Anterior</button>
            <span>Página {actual+1} de {paginas}</span><button className="boton" disabled={actual+1 >= paginas} onClick={() => setPagina(actual+1)}>Siguiente</button></div>
        </Tarjeta>
      )}

      {seccion === 'indicadores' && (
        <Tarjeta titulo="Indicadores de mercado">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-apagado">
                <tr><th className="pb-2 font-normal">Indicador</th><th className="pb-2 text-right font-normal">Valor</th><th className="pb-2 font-normal pl-3">Unidad</th>
                  <th className="pb-2 font-normal">Fecha</th><th className="pb-2 font-normal">Tipo</th><th className="pb-2 font-normal">Fuente</th><th className="pb-2 font-normal">Nota</th></tr>
              </thead>
              <tbody>
                {f.indicadores.map((i) => (
                  <tr key={i.id} className="border-t border-linea align-top">
                    <td className="py-2 pr-3">{i.indicador}<p className="text-xs text-apagado">{i.cobertura}</p></td>
                    <td className="py-2 text-right">{i.valor.toLocaleString('es-SV')}</td>
                    <td className="py-2 pl-3">{i.unidad}</td>
                    <td className="py-2">{i.fecha_dato}</td>
                    <td className="py-2"><TipoDato tipo={i.tipo} /></td>
                    <td className="py-2">{i.fuente_id}</td>
                    <td className="py-2 text-xs text-tenue">{i.nota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      {seccion === 'censo' && (
        <Tarjeta titulo="Población por distrito, Censo 2024" descripcion="San Salvador Centro es el municipio; San Salvador es uno de sus cinco distritos."
          accion={<TipoDato tipo="observado" />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-apagado">
                <tr><th className="pb-2 font-normal">Departamento</th><th className="pb-2 font-normal">Municipio</th><th className="pb-2 font-normal">Distrito</th>
                  <th className="pb-2 text-right font-normal">Población 2024</th><th className="pb-2 pl-3 font-normal">Fuente</th></tr>
              </thead>
              <tbody>
                {f.censo.map((c) => (
                  <tr key={c.distrito} className={`border-t border-linea ${c.distrito === 'San Salvador' ? 'text-texto' : ''}`}>
                    <td className="py-1.5">{c.departamento}</td><td className="py-1.5">{c.municipio}</td><td className="py-1.5">{c.distrito}</td>
                    <td className="py-1.5 text-right">{entero(c.poblacion_2024)}</td><td className="py-1.5 pl-3">{c.fuente_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      {seccion === 'fuentes' && (
        <div className="space-y-6">
          <Tarjeta titulo="Fuentes del análisis">
            <div className="overflow-x-auto"><table className="tabla-fuentes"><thead><tr><th>Fuente</th><th>Información</th><th>Consulta</th><th>Enlace</th></tr></thead><tbody>
              {f.fuentes.map(s => <tr key={s.id}><td>{s.fuente}<small>{s.id} · {s.tipo}</small></td><td><details><summary>{s.dato}</summary>
                <p>{s.valor} {s.unidad} · {s.cobertura} · {s.fecha_dato}</p><p>{s.metodo}</p><p>{s.limitaciones}</p></details></td>
                <td>{s.fecha_consulta}</td><td>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">Abrir <ExternalLink size={12}/></a> : '—'}</td></tr>)}
            </tbody></table></div>
          </Tarjeta>
        </div>
      )}
      {(seccion === 'kmeans' || seccion === 'knn') && <Tarjeta titulo={seccion === 'kmeans' ? 'Cómo formamos los grupos' : 'Cómo clasificamos una propuesta'}>
        <p>{seccion === 'kmeans' ? 'Convertimos las coordenadas a metros y agrupamos los concesionarios por proximidad. Comparamos el silhouette y el tamaño de los grupos. La diana indica la posición media de cada grupo.' : 'Para cada propuesta buscamos sus tres vecinos más próximos en línea recta. La zona más frecuente entre esos vecinos determina la clasificación. La validación compara esa etiqueta con el agrupamiento de K-Means.'}</p>
        <Link className="enlace-mapa mt-4" to={'/' + seccion}>Explorar el modelo y sus gráficos →</Link>
      </Tarjeta>}
      {seccion === 'limites' && (<div>
          <Tarjeta titulo="Limitaciones generales">
            <p className="mb-3">Para decidir sobre la viabilidad comercial aún se requieren estudios de demanda, tráfico y costos del inmueble.</p><ul className="space-y-2 text-sm text-tenue">{f.limitaciones.map((l) => <li key={l} className="border-l-2 border-linea pl-3">{l}</li>)}</ul>
          </Tarjeta>
        </div>
      )}

      {seccion === 'descargas' && (
        <Tarjeta titulo="Archivos descargables" descripcion="Datos originales y resultados calculados por el backend.">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {f.descargas.map((d) => (
              <li key={d}>
                <a href={api.descarga(d)} className="flex items-center gap-2 rounded-lg border border-linea px-3 py-2 text-sm hover:bg-superficie-2">
                  <Download className="size-4 text-texto" /> {d}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4"><Nota>Los archivos de la carpeta datos son datos de entrada; los de resultados son calculados.</Nota></div>
        </Tarjeta>
      )}
    </>
  )
}
