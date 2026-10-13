import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import './universal.css'

function cleanupLegacyPwa() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations
        .filter((registration) => registration.scope.includes('/processofacil/'))
        .map((registration) => registration.unregister()))

      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names
          .filter((name) => name.toLowerCase().includes('processofacil'))
          .map((name) => caches.delete(name)))
      }
    } catch (error) {
      console.warn('Não foi possível limpar o cache legado da PWA.', error)
    }
  })
}

cleanupLegacyPwa()

const root = document.getElementById('root')
if (!root) throw new Error('Elemento #root não encontrado')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
