import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingScreen from '../components/ui/LoadingScreen'

/**
 * ProtectedRoute — requires authentication.
 * Optionally restricts to specific roles.
 */
export function ProtectedRoute({ children, roles = [] }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles.length > 0 && !roles.includes(profile?.role)) {
    // Redirect to appropriate home based on actual role
    const roleHome = {
      customer:    '/',
      worker:      '/admin/queue',
      salon_owner: '/admin',
      super_admin: '/super-admin',
    }
    return <Navigate to={roleHome[profile?.role] ?? '/'} replace />
  }

  return children
}

/**
 * GuestRoute — accessible only when NOT logged in.
 * Redirects logged-in users away from login/register pages.
 */
export function GuestRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />

  if (user) {
    const roleHome = {
      customer:    '/',
      worker:      '/admin/queue',
      salon_owner: '/admin',
      super_admin: '/super-admin',
    }
    return <Navigate to={roleHome[profile?.role] ?? '/'} replace />
  }

  return children
}
