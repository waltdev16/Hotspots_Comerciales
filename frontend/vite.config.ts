import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// CARTO_ se expone al navegador porque la clave de mapas base es de uso público en el cliente.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envPrefix: ['VITE_', 'CARTO_'],
  server: { port: 5173, strictPort: true },
})
