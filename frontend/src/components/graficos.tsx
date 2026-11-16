export function Medidor({ valor, maximo, color = '#333639', etiqueta, texto, destacado = false }: {
  valor: number | null; maximo: number; color?: string; etiqueta: string; texto: string; destacado?: boolean
}) {
  const ancho = valor === null || maximo <= 0 ? 0 : (valor / maximo) * 100
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-tenue">{etiqueta}</span>
        <span className={destacado ? 'font-semibold text-texto' : 'text-texto'}>{texto}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-superficie-2" role="presentation">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${ancho}%`, background: color }} />
      </div>
    </div>
  )
}

