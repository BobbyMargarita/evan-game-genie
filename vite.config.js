import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Served from https://<user>.github.io/evan-game-genie/
  base: '/evan-game-genie/',
  plugins: [react()],
})
