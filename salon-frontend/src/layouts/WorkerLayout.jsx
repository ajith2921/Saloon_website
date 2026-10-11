import { Outlet, NavLink } from 'react-router-dom'
import { Ticket, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function WorkerLayout() {
  const { signOut } = useAuth()

  const mobileNav = [
    { to: '/worker', icon: Ticket, label: 'Queue' },
  ]

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface-primary">
      {/* Skip to main content */}
      <a
        href="#worker-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-brand-500 focus:text-white focus:font-bold focus:text-sm"
      >
        Skip to main content
      </a>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6 border-b border-white/[0.06] bg-surface-primary/90 backdrop-blur sticky top-0 z-10">
          <h1 className="text-sm font-semibold text-dark-100">Worker Portal</h1>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button
              onClick={signOut}
              className="p-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 active:scale-95 transition-all"
              aria-label="Sign Out"
            >
              <LogOut className="w-5 h-5 text-red-500" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main id="worker-main-content" className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-6 pb-28 md:pb-8 scrollbar-thin">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-secondary/95 backdrop-blur-xl border-t border-white/10 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.5)]" aria-label="Worker mobile navigation">
        <div className="flex items-center justify-around h-16 px-2">
          {mobileNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={true}
              aria-label={label}
              className={({ isActive }) => 
                `flex flex-col items-center justify-center w-20 h-full gap-1 transition-colors active:scale-95 ${
                  isActive ? 'text-brand-400 font-bold' : 'text-dark-200 hover:text-dark-100'
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
