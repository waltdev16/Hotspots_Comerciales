import { useCallback, useEffect, useState } from 'react'

// Carga datos de la API con estado de carga, error y reintento.
export function useApi<T>(cargar: () => Promise<T>, dependencias: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError(null)
    cargar()
      .then((d) => { if (activo) setDatos(d) })
      .catch((e: Error) => { if (activo) setError(e.message) })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento, ...dependencias])

  const reintentar = useCallback(() => setIntento((i) => i + 1), [])
  return { datos, error, cargando, reintentar }
}
