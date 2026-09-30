import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/processofacil/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Processo Fácil',
        short_name: 'Processo Fácil',
        description: 'Gestão da terceirização de confecção',
        theme_color: '#0B1F4B',
        background_color: '#F4F7FB',
        display: 'standalone',
        start_url: '/processofacil/#/',
        icons: []
      }
    })
  ]
})
