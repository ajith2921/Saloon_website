import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

const Button = forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false, 
  loading = false, 
  icon: Icon,
  className = '',
  disabled,
  ...props 
}, ref) => {
  const baseClasses = variant === 'icon' 
    ? 'btn-icon inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none'
    : `btn-${variant} inline-flex justify-center items-center gap-2 focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none`
  
  const sizeClasses = variant === 'icon' 
    ? '' // btn-icon handles its own padding
    : size === 'sm' ? 'px-3 py-1.5 text-xs' 
    : size === 'lg' ? 'px-8 py-4 text-base' 
    : 'px-5 py-2.5 text-sm' // md (default)

  const widthClass = fullWidth ? 'w-full' : ''
  const opacityClass = (disabled || loading) ? 'opacity-50 pointer-events-none' : ''

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-disabled={disabled || loading || undefined}
      aria-busy={loading || undefined}
      className={[baseClasses, sizeClasses, widthClass, opacityClass, className].filter(Boolean).join(' ')}
      {...props}
    >
      {loading && (
        <>
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading…</span>
        </>
      )}
      {!loading && Icon && <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} aria-hidden="true" />}
      {children}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
