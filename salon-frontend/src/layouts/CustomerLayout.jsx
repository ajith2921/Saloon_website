import React from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Home, Search, Clock, User, LogOut, Scissors, Bell } from 'lucide-react'
import { useFetch } from '../hooks/useApi'
import { Button } from '../components/ui'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function CustomerLayout() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Only fetch notifications when the user is authenticated — avoids a 422
  // error on every public page visit by anonymous visitors.
  const { data: notificationsData } = useFetch(user ? '/api/notifications' : null)

  const unreadCount = user ? (notificationsData?.notifications ?? []).filter(n => !n.is_read).length : 0

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Salons', path: '/salons', icon: Search },
    { name: 'My Token', path: '/my-token', icon: Clock },
    { name: 'Profile', path: '/profile', icon: User },
  ]

  return (
    <div className="min-h-screen bg-surface-primary flex flex-col font-sans">
      {/* Skip to main content — visible on keyboard focus, hidden otherwise (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-brand-500 focus:text-white focus:font-bold focus:text-sm"
      >
        Skip to main content
      </a>

      {/* Desktop Top Navbar */}
      <header className="hidden sm:block sticky top-0 z-50 bg-surface-secondary/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center border border-brand-500/30 group-hover:bg-brand-500/30 transition-colors">
              <Scissors className="w-5 h-5" />
            </div>
            <span className="text-xl font-display font-bold text-white tracking-tight">
              Queue<span className="text-brand-400">Cut</span>
            </span>
          </Link>

          <nav className="flex items-center gap-6" aria-label="Main navigation">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path))
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    isActive ? 'text-brand-400' : 'text-dark-200 hover:text-white'
                  }`}
                >
                  {link.name}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            {user ? (
              <div className="flex items-center gap-4">
                {profile?.role === 'customer' && (
                  <Link
                    to="/partner"
                    className="text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors hidden sm:block"
                  >
                    Partner with us
                  </Link>
                )}
                {profile?.role === 'salon_owner' && (
                  <Link
                    to="/admin"
                    className="text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors hidden sm:block"
                  >
                    Dashboard
                  </Link>
                )}
                {profile?.role === 'super_admin' && (
                  <Link
                    to="/super-admin"
                    className="text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors hidden sm:block"
                  >
                    Super Dashboard
                  </Link>
                )}
                <Link
                  to="/notifications"
                  aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                  className="relative text-dark-200 hover:text-white transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-error rounded-full text-[10px] font-bold text-white flex items-center justify-center border-2 border-surface-secondary">
                      {unreadCount}
                    </span>
                  )}
                </Link>
                <span className="text-sm font-medium text-dark-100 hidden md:block">
                  Hi, {profile?.full_name?.split(' ')[0] || 'User'}
                </span>
                <Button
                  variant="ghost"
                  onClick={handleSignOut}
                  className="px-3 py-1.5 text-xs text-error hover:text-error hover:bg-error/10"
                >
                  <LogOut className="w-4 h-4 mr-1 hidden sm:block" />
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex gap-3 items-center">
                <Link to="/login" className="btn-ghost px-5 py-2 text-sm">Login</Link>
                <Link to="/register" className="btn-primary px-5 py-2 text-sm">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Top Header (Minimal) */}
      <header className="sm:hidden sticky top-0 z-50 bg-surface-primary/90 backdrop-blur-md border-b border-white/5 h-14 flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-1.5">
          <Scissors className="w-5 h-5 text-brand-400" />
          <span className="text-lg font-display font-bold text-white tracking-tight">
            Queue<span className="text-brand-400">Cut</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {user ? (
            <>
            <Link
              to="/notifications"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              className="relative text-dark-200 hover:text-white transition-colors p-2.5 rounded-xl hover:bg-white/5 active:scale-95"
            >
              <Bell className="w-5 h-5" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-error rounded-full border-2 border-surface-primary" aria-hidden="true" />
              )}
            </Link>
            <button 
              onClick={handleSignOut} 
              aria-label="Sign out" 
              className="text-dark-200 hover:text-error p-2.5 rounded-xl hover:bg-white/5 active:scale-95 transition-colors"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
            </button>
            </>
          ) : (
            <Link to="/login" className="text-xs font-bold text-brand-400 px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20">Login</Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 pb-32 sm:pb-8">
        <Outlet />
      </main>

      {/* Desktop Footer */}
      <footer className="hidden sm:block border-t border-white/10 mt-auto bg-surface-secondary/50">
        <div className="max-w-7xl mx-auto py-6 px-6 text-center">
          <p className="text-sm text-dark-300">
            &copy; {new Date().getFullYear()} QueueCut Men's Salon Platform. Built for premium grooming.
          </p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-secondary/95 backdrop-blur-xl border-t border-white/10 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.5)]" aria-label="Mobile navigation">
        <div className="flex items-center justify-around h-16 px-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path))
            const Icon = link.icon
            return (
              <Link
                key={link.name}
                to={link.path}
                aria-label={link.name}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex-1 flex flex-col items-center justify-center h-full max-w-[84px] py-1 transition-all active:scale-95 ${
                  isActive ? 'text-brand-400 font-bold' : 'text-dark-200 hover:text-dark-100 font-medium'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-brand-500/15 shadow-glow-sm' : ''}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-brand-400' : 'text-dark-200'}`} aria-hidden="true" />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5" aria-hidden="true">{link.name}</span>
                {isActive && (
                  <span className="absolute top-0 inset-x-4 h-0.5 bg-brand-400 rounded-full shadow-glow-sm" aria-hidden="true" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

    </div>
  )
}
