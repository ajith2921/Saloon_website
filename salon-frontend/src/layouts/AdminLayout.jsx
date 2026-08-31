import { Outlet, NavLink } from 'react-router-dom'
import { useState } from 'react'
import AdminSidebar from '../components/navigation/AdminSidebar'
import { Bell, LayoutDashboard, Ticket, Users, Settings } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { isOwner } = useAuth()

  const mobileNav = isOwner ? [
    { to: '/admin', icon: LayoutDashboard, label: 'Dash' },
    { to: '/admin/queue', icon: Ticket, label: 'Queue' },
    { to: '/admin/customers', icon: Users, label: 'Cust' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' },
  ] : [
    { to: '/admin/queue', icon: Ticket, label: 'Queue' },
  ]

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface-primary">
      {/* Skip to main content — visible on keyboard focus */}
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-brand-500 focus:text-white focus:font-bold focus:text-sm"
      >
        Skip to main content
      </a>

      {/* Sidebar - Desktop only */}
      <div className="hidden md:flex">
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/[0.06] bg-surface-primary/90 backdrop-blur sticky top-0 z-10">
          <h1 className="text-sm font-semibold text-dark-100">Admin Area</h1>
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
