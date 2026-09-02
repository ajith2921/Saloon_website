import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

/**
 * Detects stale JS chunk errors that happen after a new deployment:
 * Vercel's SPA rewrite returns index.html (200) for missing chunks,
 * the browser then fails to execute "HTML" as JS.
 */
function isChunkLoadError(error) {
  if (!error) return false
  const msg = error?.message ?? ''
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    error?.name === 'ChunkLoadError'
  )
}

/**
 * ErrorBoundary — wraps the entire app to catch render-time crashes
 * and show a friendly error page instead of a blank white screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    // In production you'd send this to a logging service
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)

    // ── Stale-chunk auto-recovery ───────────────────────────────────────────
    // After a Vercel redeployment the hashed chunk filenames change. When a
    // user navigates client-side, React tries to lazy-import the OLD chunk
    // name; Vercel's SPA rewrite returns index.html instead of the JS file.
    // Hard-reload ONCE to fetch the new index with correct chunk URLs.
    if (isChunkLoadError(error)) {
      const reloadKey = 'chunk_error_reloaded'
      const alreadyReloaded = sessionStorage.getItem(reloadKey)
      if (!alreadyReloaded) {
        sessionStorage.setItem(reloadKey, '1')
        window.location.reload()
      } else {
        // Already reloaded once — clear so future navigations can retry
        sessionStorage.removeItem(reloadKey)
      }
    }
  }

  componentDidUpdate(prevProps) {
    // Reset error state when the route changes so navigating away clears the
    // error boundary (works when location is passed as a prop by the parent).
    if (this.state.hasError && prevProps.location !== this.props.location) {
      this.setState({ hasError: false, error: null, errorInfo: null })
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      // For chunk load errors show a brief "reloading" spinner so users
      // aren't confused by the generic error UI during the auto-reload.
      if (isChunkLoadError(this.state.error)) {
        return (
          <div className="min-h-screen bg-surface-primary flex items-center justify-center px-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
              </div>
              <p className="text-white font-semibold mb-1">Loading new version…</p>
              <p className="text-dark-200 text-sm">The app was updated. Refreshing automatically.</p>
            </div>
          </div>
        )
      }

      return (
        <div className="min-h-screen bg-surface-primary flex items-center justify-center px-4" role="alert">
          {/* Ambient glow */}
          <div className="absolute inset-0 bg-gradient-radial from-red-500/5 via-transparent to-transparent pointer-events-none" aria-hidden="true" />

          <div className="relative z-10 w-full max-w-md text-center">
            {/* Icon */}
            <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6 shadow-lg" aria-hidden="true">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>

            <h1 className="text-2xl font-display font-bold text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-dark-100 text-sm leading-relaxed mb-2">
              An unexpected error occurred. This is usually caused by a network issue or a bug.
            </p>

            {/* Dev-mode error details */}
            {import.meta.env.DEV && this.state.error && (
              <details className="text-left mb-6 bg-surface-secondary border border-white/10 rounded-xl p-4 text-xs text-red-300 font-mono overflow-auto max-h-40">
                <summary className="cursor-pointer text-dark-200 mb-2 font-sans font-medium">
                  Error details (dev only)
                </summary>
                {this.state.error?.toString()}
                {this.state.errorInfo?.componentStack}
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <button
                onClick={this.handleReset}
                className="btn-secondary justify-center"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" /> Try Again
              </button>
              <a href="/" className="btn-primary justify-center">
                <Home className="w-4 h-4" aria-hidden="true" /> Go to Home
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
