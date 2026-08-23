import { forwardRef } from 'react'

const Input = forwardRef(({ 
  label, 
  error, 
  icon: Icon, 
  className = '',
  wrapperClassName = '',
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
        <input
          ref={ref}
          className={`input focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none ${Icon ? 'pl-10' : ''} ${error ? 'border-error/50 focus:border-error/50 focus-visible:ring-error/50' : ''} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error && errorId ? errorId : undefined}
          {...props}
        />
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-error" role="alert">{error}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input
