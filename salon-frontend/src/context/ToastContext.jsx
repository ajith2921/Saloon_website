import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, type, title, message }])
    setTimeout(() => removeToast(id), duration)
    return id
  }, [removeToast])

  const success = (message, title = 'Success') => addToast({ type: 'success', title, message })
  const error   = (message, title = 'Error')   => addToast({ type: 'error',   title, message })
  const info    = (message, title = 'Info')    => addToast({ type: 'info',    title, message })
  const warning = (message, title = 'Warning') => addToast({ type: 'warning', title, message })

  return (
    <ToastContext.Provider value={{ success, error, info, warning, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null
  return (
    // aria-live="polite": screen readers announce new toasts without interrupting.
    // aria-atomic="false": each individual toast is announced separately.
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

function Toast({ toast, onRemove }) {
  const colors = {
    success: 'border-green-500/40 bg-green-500/10',
    error:   'border-red-500/40   bg-red-500/10',
    warning: 'border-amber-500/40 bg-amber-500/10',
    info:    'border-blue-500/40  bg-blue-500/10',
  }
  const textColors = {
    success: 'text-green-400',
    error:   'text-red-400',
    warning: 'text-amber-400',
    info:    'text-blue-400',
  }
  // Errors use role="alert" (assertive); all others use role="status" (polite).
  // The outer aria-live on ToastContainer already handles announcements;
  // the per-toast role provides fallback semantics for screen readers that
  // don't support live regions inside a pointer-events-none container.
  const role = toast.type === 'error' ? 'alert' : 'status'

  return (
    <div
      role={role}
      className={`pointer-events-auto animate-slide-up flex items-start gap-3 p-4
        rounded-xl border backdrop-blur-xl shadow-card ${colors[toast.type]}`}
    >
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className={`font-semibold text-sm ${textColors[toast.type]}`}>{toast.title}</p>
        )}
        {toast.message && (
          <p className="text-dark-100 text-xs mt-0.5 leading-relaxed">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
        className="text-dark-200 hover:text-white transition-colors text-lg leading-none flex-shrink-0 mt-0.5 focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none rounded"
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
