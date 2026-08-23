import { forwardRef } from 'react'

const Select = forwardRef(({ 
  label, 
  error, 
  icon: Icon,
  className = '',
  wrapperClassName = '',
  children,
  ...props 
}, ref) => {
  const errorId = props.id ? `${props.id}-error` : undefined
  return (
    <div className={`w-full ${wrapperClassName}`}>
      {label && (
        <label className="input-label" htmlFor={props.id}>
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-200 pointer-events-none" aria-hidden="true" />
        )}
        <select
          ref={ref}
          className={`select focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none ${Icon ? 'pl-10' : ''} ${error ? 'border-error/50 focus:border-error/50 focus-visible:ring-error/50' : ''} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error && errorId ? errorId : undefined}
          {...props}
        >
          {children}
        </select>
        {/* Decorative chevron — hidden from assistive technology */}
        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-dark-200" aria-hidden="true">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-error" role="alert">{error}</p>
      )}
    </div>
  )
})

Select.displayName = 'Select'

export default Select
