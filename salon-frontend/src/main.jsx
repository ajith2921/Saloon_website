import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import AppRouter from './routes/AppRouter'
import ErrorBoundary from './components/ErrorBoundary'
import './i18n'
import './index.css'

// ── Stale-chunk recovery (global) ────────────────────────────────────────────
// When React lazily imports a JS chunk after a new Vercel deployment, the old
// hashed filename no longer exists. Vercel's SPA rewrite returns index.html
// (HTTP 200), which the browser tries to parse as JS — causing a
// "Failed to fetch dynamically imported module" unhandled rejection.
// We detect this here (before it even reaches ErrorBoundary) and hard-reload
// once, so the browser fetches the new index.html with the updated chunk URLs.
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const msg = reason?.message ?? ''
  const isChunkError =
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    reason?.name === 'ChunkLoadError'

  if (isChunkError) {
    const reloadKey = 'chunk_error_reloaded'
    const alreadyReloaded = sessionStorage.getItem(reloadKey)
    if (!alreadyReloaded) {
      sessionStorage.setItem(reloadKey, '1')
      window.location.reload()
    } else {
      sessionStorage.removeItem(reloadKey)
    }
  }
})

// Fix Leaflet default marker icons broken by Vite's asset hashing (BUG-034)
import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <AppRouter />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
