import { forwardRef } from 'react'

const Textarea = forwardRef(({ 
  label, 
  error, 
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
      <textarea
        ref={ref}
        className={`input min-h-[100px] resize-y focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none ${error ? 'border-error/50 focus:border-error/50 focus-visible:ring-error/50' : ''} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && errorId ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-error" role="alert">{error}</p>
      )}
    </div>
  )
})

Textarea.displayName = 'Textarea'

export default Textarea
