import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import AuthGate from './auth/AuthGate'
import './styles.css'
import './universal.css'

function cleanupLegacyPwa() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        registrations
          .filter((registration) => registration.scope.includes('/processofacil/'))
          .map((registration) => registration.unregister()),
      )
    } catch (error) {
      console.warn('Não foi possível limpar o service worker legado.', error)
    }
  })
}

cleanupLegacyPwa()

const root = document.getElementById('root')
if (!root) throw new Error('Elemento #root não encontrado')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
)
