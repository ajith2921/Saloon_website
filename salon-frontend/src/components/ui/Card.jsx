export function Card({ children, className = '', hover = false, elevated = false, ...props }) {
  const baseClass = elevated ? 'card-elevated' : 'card'
  const hoverClass = hover ? 'card-hover' : ''
  return (
    <div className={`${baseClass} ${hoverClass} p-6 ${className}`} {...props}>
      {children}
    </div>
  )
}
