import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export default function Modal({ titulo, cerrar, clase = '', children }: {
  titulo: string; cerrar: () => void; clase?: string; children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [visible, setVisible] = useState(false)
  useLayoutEffect(() => {
    const dialogo = ref.current!
    const foco = document.activeElement as HTMLElement | null
    dialogo.showModal()
    setVisible(true)
    return () => { dialogo.close(); foco?.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} className={clase} aria-label={titulo}
    onCancel={e => { e.preventDefault(); cerrar() }}>{visible && children}</dialog>
}
