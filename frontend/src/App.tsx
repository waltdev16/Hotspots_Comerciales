import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout'
import Inicio from './pages/Inicio'
import { Cargando } from './components/ui'

// Las páginas con mapas y gráficos se cargan bajo demanda.
const Mapa = lazy(() => import('./pages/Mapa'))
const KMeans = lazy(() => import('./pages/KMeans'))
const KNN = lazy(() => import('./pages/KNN'))
const Comparador = lazy(() => import('./pages/Comparador'))
const Conclusiones = lazy(() => import('./pages/Conclusiones'))
const Datos = lazy(() => import('./pages/Datos'))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Cargando texto="Cargando la página" />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Inicio />} />
            <Route path="mapa" element={<Mapa />} />
            <Route path="kmeans" element={<KMeans />} />
            <Route path="knn" element={<KNN />} />
            <Route path="comparacion" element={<Comparador />} />
            <Route path="conclusiones" element={<Conclusiones />} />
            <Route path="datos" element={<Datos />} />
            <Route path="machine-learning" element={<Navigate to="/kmeans" replace />} />
            <Route path="comparador" element={<Navigate to="/comparacion" replace />} />
            <Route path="*" element={<p className="text-tenue">Página no encontrada.</p>} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
