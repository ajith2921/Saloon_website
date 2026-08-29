import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Scissors, LayoutDashboard, Building2, CreditCard, Megaphone, BarChart2, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui'

const superNav = [
  { to: '/super-admin',               label: 'Dashboard',    icon: LayoutDashboard, exact: true },
  { to: '/super-admin/salons',         label: 'Salons',       icon: Building2 },
  { to: '/super-admin/subscriptions',  label: 'Plans',        icon: CreditCard },
  { to: '/super-admin/advertisements', label: 'Ads',          icon: Megaphone },
  { to: '/super-admin/analytics',      label: 'Analytics',    icon: BarChart2 },
]

export default function SuperAdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const displayName = profile?.full_name ?? 'Super Admin'

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface-primary">
      {/* Skip link for keyboard users */}
      <a
        href="#super-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-purple-500 focus:text-white focus:font-bold focus:text-sm"
      >
        Skip to main content
      </a>

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-60 flex-col bg-surface-secondary border-r border-white/[0.06] sticky top-0 h-screen">
        <div className="flex items-center gap-3 h-16 px-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center" aria-hidden="true">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">QueueCut</p>
            <p className="text-[10px] text-purple-400 uppercase tracking-wider">Super Admin</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-2 py-4 flex flex-col gap-0.5 overflow-y-auto" aria-label="Super Admin navigation">
          {superNav.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                    : 'text-dark-100 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-purple-400' : ''}`} aria-hidden="true" />
                  <span>{label}</span>
                  {isActive && <span className="sr-only">(current page)</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User profile + sign out */}
        <div className="p-3 border-t border-white/[0.06] flex-shrink-0 space-y-1">
          {/* Identity pill */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/15 mb-1">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{displayName}</p>
              <p className="text-[10px] text-purple-400 uppercase tracking-wider">Super Admin</p>
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={async () => { await signOut(); navigate('/') }}
            className="w-full justify-start gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 text-sm font-medium transition-all"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main id="super-main-content" className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 pb-24 md:pb-6 scrollbar-thin">
        <Outlet />
      </main>

      {/* ── Mobile Bottom Navigation — all 5 items ── */}
      <nav
        className="md:hidden fixed bottom-0 w-full z-50 bg-surface-secondary/95 backdrop-blur-xl border-t border-white/10 pb-safe"
        aria-label="Super Admin navigation"
      >
        <div className="flex items-center justify-around h-16 px-1">
          {superNav.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              aria-label={label}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                  isActive ? 'text-purple-400' : 'text-dark-200 hover:text-dark-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-purple-400' : ''}`} aria-hidden="true" />
                  <span className="text-[9px] font-medium leading-none" aria-hidden="true">{label}</span>
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
