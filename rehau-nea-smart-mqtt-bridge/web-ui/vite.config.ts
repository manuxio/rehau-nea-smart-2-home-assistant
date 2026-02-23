import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Read version from parent package.json
const parentPackageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf-8')
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for HA ingress compatibility
  define: {
    '__APP_VERSION__': JSON.stringify(parentPackageJson.version),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
