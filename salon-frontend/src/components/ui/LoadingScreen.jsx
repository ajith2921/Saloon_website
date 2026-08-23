import { Scissors } from 'lucide-react'

/**
 * LoadingScreen — used as the Suspense fallback for all lazy-loaded routes.
 * role="status" + aria-live="polite": screen readers announce the message
 * without interrupting current speech (polite). aria-atomic="true" ensures
 * the full message is read when it first appears.
 * The decorative animation gets aria-hidden so it is not described.
 */
export default function LoadingScreen({ message = 'Loading…' }) {
  return (
    <div
      className="min-h-screen bg-surface-primary flex flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={message}
    >
      <div className="relative" aria-hidden="true">
        <div className="w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-glow-gold">
          <Scissors className="w-8 h-8 text-white" />
        </div>
        <div className="absolute -inset-1 rounded-2xl border border-brand-500/30 animate-ping" />
      </div>
      {/* Visible text — also the accessible name via aria-label on the container */}
      <p className="text-dark-100 text-sm animate-pulse" aria-hidden="true">{message}</p>
    </div>
  )
}
