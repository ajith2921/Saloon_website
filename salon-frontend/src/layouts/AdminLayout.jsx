import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import AdminSidebar from '../components/navigation/AdminSidebar'
import { Bell, LayoutDashboard, Ticket, Users, Settings, Clock, LogOut, CreditCard, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Button from '../components/ui/Button'
import { useTranslation } from 'react-i18next'

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])
  const { isOwner, profile, signOut } = useAuth()
  const mobileNav = isOwner ? [
    { to: '/admin', icon: LayoutDashboard, label: t('admin_nav.dashboard') },
    { to: '/admin/queue', icon: Ticket, label: t('admin_nav.live_queue') },
    { to: '/admin/customers', icon: Users, label: t('admin_nav.customers') },
    { to: '/admin/settings', icon: Settings, label: t('admin_nav.settings') },
  ] : [
    { to: '/admin/queue', icon: Ticket, label: t('admin_nav.live_queue') },
  ]

  const isPending = isOwner && profile?.salons?.[0]?.status === 'pending'
  const isSubscriptionRoute = location.pathname === '/admin/subscription'

  if (isPending && !isSubscriptionRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-primary p-6">
        <div className="max-w-md w-full bg-surface-secondary border border-white/[0.06] rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-brand-500/10 text-brand-400 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Application Under Review</h1>
            <p className="text-dark-200 text-sm leading-relaxed mb-6">
              Your salon application is currently being reviewed for our free tier. We will notify you once it has been approved. 
            </p>
            <div className="bg-white/[0.02] border border-brand-500/20 rounded-xl p-4 text-left">
              <h3 className="text-white font-medium mb-1">Want instant access?</h3>
              <p className="text-dark-300 text-xs mb-4">Skip the manual review and unlock your dashboard immediately by purchasing a subscription.</p>
              <Button variant="primary" onClick={() => navigate('/admin/subscription')} className="w-full bg-brand-500 hover:bg-brand-600 text-white">
                <CreditCard className="w-4 h-4 mr-2" />
                View Subscription Plans
              </Button>
            </div>
          </div>
          <div className="pt-4 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={signOut} className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              Wait & Sign Out
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isPending && isSubscriptionRoute) {
    return (
      <div className="min-h-screen bg-surface-primary flex flex-col">
        <header className="h-16 flex items-center px-6 border-b border-white/[0.06] bg-surface-primary/90 backdrop-blur sticky top-0 z-10">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="-ml-2">
            ← Back to Status
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface-primary">
      {/* Skip to main content — visible on keyboard focus */}
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-brand-500 focus:text-white focus:font-bold focus:text-sm"
      >
        Skip to main content
      </a>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[100] flex">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileMenuOpen(false)} 
            aria-hidden="true"
          />
          <div className="relative flex flex-col w-64 max-w-[80%] bg-surface-secondary h-full animate-slide-right shadow-2xl">
            <button 
              className="absolute top-4 right-4 p-2 text-dark-200 hover:text-white z-50 bg-black/20 rounded-full"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 overflow-y-auto h-full w-full">
               <AdminSidebar collapsed={false} onToggle={() => {}} />
            </div>
          </div>
        </div>
      )}

      {/* Sidebar - Desktop only */}
      <div className="hidden md:flex">
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-white/[0.06] bg-surface-primary/90 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 -ml-2 text-dark-200 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-semibold text-dark-100 hidden sm:block">{t('admin_nav.admin_panel')}</h1>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <NavLink
              to="/notifications"
              className="btn-icon relative"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-surface-primary" aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <main id="admin-main-content" className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 bg-surface-secondary/90 backdrop-blur-xl border-t border-white/10 pb-safe" aria-label="Admin mobile navigation">
        <div className="flex items-center justify-around h-16 px-2">
          {mobileNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              aria-label={label}
              className={({ isActive }) => 
                `flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${
                  isActive ? 'text-brand-400' : 'text-dark-200 hover:text-dark-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 ${isActive ? 'animate-pulse-slow' : ''}`} aria-hidden="true" />
                  <span className="text-[10px] font-medium" aria-hidden="true">{label}</span>
                  {isActive && <span className="sr-only">(current page)</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
