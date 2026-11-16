
export const COLOR_ZONA: Record<string, string> = {
  'Zona 1': '#196578',
  'Zona 2': '#aa5417',
  'Zona 3': '#6f8f86',
}
export const colorZona = (zona?: string | null) => (zona && COLOR_ZONA[zona]) || '#b9bcb6'
