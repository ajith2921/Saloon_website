import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

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
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
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
