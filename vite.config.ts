import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  server: {
    proxy: {
      '/s': 'http://localhost:8080',
      '/backends': 'http://localhost:8080',
      '/openapi.json': 'http://localhost:8080',
    },
  },
})
