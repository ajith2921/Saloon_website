/**
 * Spinner — inline loading indicator
 * role="status" + aria-label ensures screen readers announce the loading state.
 */
import Button from './Button'
import { useEffect, useRef } from 'react'
export function Spinner({ size = 'md', className = '', label = 'Loading…' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <div role="status" aria-label={label} className="inline-flex">
      <div
        className={clsx(
          'rounded-full border-2 border-white/20 border-t-brand-500 animate-spin',
          sizes[size],
          className
        )}
        aria-hidden="true"
      />
    </div>
  )
}

/**
 * Empty state component
 */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      {Icon && (
        <div className="w-20 h-20 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-6 shadow-glow-sm">
          <Icon className="w-10 h-10 text-brand-400" />
        </div>
      )}
      <h3 className="text-xl font-display font-bold text-white mb-2 tracking-tight">{title}</h3>
      {description && <p className="text-dark-100 text-[15px] max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-8 transition-transform hover:-translate-y-0.5">{action}</div>}
    </div>
  )
}

/**
 * Section header
 */
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {subtitle && <p className="text-dark-100 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

/**
 * Token status badge
 */
export function TokenBadge({ status }) {
  const cls = {
    waiting:   'badge-waiting',
    called:    'badge-called',
    serving:   'badge-serving',
    completed: 'badge-completed',
    skipped:   'badge-skipped',
    cancelled: 'badge-cancelled',
    expired:   'badge-expired',
  }
  const labels = {
    waiting:   'Waiting',
    called:    'Called',
    serving:   'In Service',
    completed: 'Completed',
    skipped:   'Skipped',
    cancelled: 'Cancelled',
    expired:   'Expired',
  }
  return <span className={cls[status] ?? 'badge'}>{labels[status] ?? status}</span>
}

/**
 * Star rating display
 */
export function StarRating({ rating, max = 5, size = 'sm' }) {
  const starSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  const rounded = Math.round(rating)
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${Number(rating).toFixed(1)} out of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <svg
          key={i}
          aria-hidden="true"
          className={clsx(starSize, i < rounded ? 'text-amber-400' : 'text-dark-400')}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      {/* Numeric value shown visually; aria-label on the container provides the accessible name */}
      <span className="text-xs text-dark-100 ml-1" aria-hidden="true">{Number(rating).toFixed(1)}</span>
    </div>
  )
}

/**
 * Stat card for dashboard
 */
export function StatCard({ label, value, icon: Icon, change, color = 'brand' }) {
  const colors = {
    brand:   'text-brand-400 bg-brand-500/10',
    green:   'text-green-400 bg-green-500/10',
    blue:    'text-blue-400  bg-blue-500/10',
    amber:   'text-amber-400 bg-amber-500/10',
    red:     'text-red-400   bg-red-500/10',
    purple:  'text-purple-400 bg-purple-500/10',
  }
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <span className="stat-label">{label}</span>
        {Icon && (
          <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', colors[color])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {change !== undefined && (
        <p className={clsx('text-xs mt-1', change >= 0 ? 'text-green-400' : 'text-red-400')}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% vs yesterday
        </p>
      )}
    </div>
  )
}

/**
 * Modal wrapper
 * Accessibility: focus trap, ESC to close, focus returns to trigger element on close.
 * Uses a unique title ID per instance to avoid duplicate-id conflicts.
 */
export function Modal({ open, onClose, title, children, size = 'md', titleId }) {
  const dialogRef = useRef(null)
  const titleIdResolved = titleId ?? 'modal-title'

  // Focus the dialog panel on open; return focus to the trigger on close
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement
    // Move focus into the dialog on the next tick so the DOM is mounted
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.focus()
    })
    return () => {
      cancelAnimationFrame(frame)
      // Return focus to whatever was focused before the modal opened
      previouslyFocused?.focus()
    }
  }, [open])

  // Trap focus inside the dialog
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable?.length) return
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus() }
    }
  }

  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleIdResolved : undefined}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop — click closes the modal */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      {/* Panel — tabIndex={-1} receives programmatic focus */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={clsx('relative w-full card p-6 animate-slide-up focus:outline-none', widths[size])}
      >
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h2 id={titleIdResolved} className="text-lg font-bold text-white">{title}</h2>
            <Button variant="ghost" onClick={onClose} className="!p-1" aria-label="Close modal">
              <span aria-hidden="true" className="text-xl leading-none">×</span>
            </Button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/**
 * Confirmation dialog — replaces window.confirm() (BUG-026)
 * Accessibility: role="alertdialog", focus trap, ESC to cancel, focus returns on close.
 */
export function ConfirmModal({ open, onConfirm, onCancel, title = 'Are you sure?', message, confirmLabel = 'Confirm', danger = false }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement
    const frame = requestAnimationFrame(() => {
      // Focus the confirm button so the user's intent is clear
      const confirmBtn = dialogRef.current?.querySelector('[data-confirm]')
      if (confirmBtn) {
        confirmBtn.focus()
      } else {
        dialogRef.current?.focus()
      }
    })
    return () => {
      cancelAnimationFrame(frame)
      previouslyFocused?.focus()
    }
  }, [open])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onCancel(); return }
    if (e.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable?.length) return
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus() }
    }
  }

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby={message ? 'confirm-modal-desc' : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-sm card p-6 animate-slide-up focus:outline-none"
      >
        <h2 id="confirm-modal-title" className="text-lg font-bold text-white mb-2">{title}</h2>
        {message && <p id="confirm-modal-desc" className="text-dark-100 text-sm mb-6 leading-relaxed">{message}</p>}
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onCancel} className="px-5">
            Cancel
          </Button>
          <Button
            data-confirm
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            className="px-5"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Simple clsx helper
function clsx(...args) {
  return args.filter(Boolean).join(' ')
}

/**
 * Skeleton Loader
 * aria-hidden: true — prevents screen readers from describing a decorative loading placeholder.
 * Use a Spinner with role="status" alongside skeletons when you want SR feedback.
 */
export function Skeleton({ className = '' }) {
  return (
    <div
      className={`relative overflow-hidden bg-white/5 rounded-xl ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  )
}

/**
 * Error state — used when a data fetch fails
 * role="alert" causes screen readers to announce the error immediately when it appears.
 */
export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
      role="alert"
    >
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4" aria-hidden="true">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      {message && <p className="text-dark-100 text-sm max-w-xs mb-5 leading-relaxed">{message}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="px-5">
          Try Again
        </Button>
      )}
    </div>
  )
}

export { default as Button } from './Button'
export { default as Input } from './Input'
export { default as Select } from './Select'
export { default as Textarea } from './Textarea'
export { Card } from './Card'
export { PageHeader } from './PageHeader'
export { default as DateRangePicker } from './DateRangePicker'
