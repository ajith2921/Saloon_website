import { NavLink, useNavigate } from 'react-router-dom'
import {
  Scissors, LayoutDashboard, Ticket, Users, Briefcase,
  Star, DollarSign, BarChart2, Megaphone, Settings,
  LogOut, ChevronLeft, Menu, Eye, UserCheck, CreditCard
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTranslation } from 'react-i18next'

const ownerNav = [
  { to: '/admin',                i18nKey: 'dashboard',       icon: LayoutDashboard, exact: true },
  { to: '/admin/queue',          i18nKey: 'live_queue',      icon: Ticket },
  { to: '/admin/workers',        i18nKey: 'workers',         icon: Users },
  { to: '/admin/services',       i18nKey: 'services',        icon: Briefcase },
  { to: '/admin/customers',      i18nKey: 'customers',       icon: UserCheck },
  { to: '/admin/ratings',        i18nKey: 'ratings',         icon: Star },
  { to: '/admin/revenue',        i18nKey: 'revenue',         icon: DollarSign },
  { to: '/admin/analytics',      i18nKey: 'analytics',       icon: BarChart2 },
  { to: '/admin/advertisements',  i18nKey: 'ads',            icon: Megaphone },
  { to: '/admin/subscription',   i18nKey: 'subscription',    icon: CreditCard },
  { to: '/admin/settings',       i18nKey: 'settings',        icon: Settings },
]

const workerNav = [
  { to: '/admin/queue', i18nKey: 'live_queue', icon: Ticket },
  { to: '/admin/ratings', i18nKey: 'ratings', icon: Star },
]

export default function AdminSidebar({ collapsed, onToggle }) {
  const { profile, signOut, isOwner } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const navItems = isOwner ? ownerNav : workerNav

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <aside
      className={`flex flex-col bg-surface-secondary border-r border-white/[0.06] transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div className="flex items-center gap-3 h-16 px-4 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center flex-shrink-0" aria-hidden="true">
          <Scissors className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white whitespace-nowrap">QueueCut</p>
            <p className="text-[10px] text-dark-200 whitespace-nowrap uppercase tracking-wider">{t('admin_nav.admin_panel')}</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="ml-auto text-dark-200 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none rounded"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <Menu className="w-4 h-4" aria-hidden="true" /> : <ChevronLeft className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>

      {/* Profile */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-surface-tertiary">
            <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {profile?.full_name?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{profile?.full_name}</p>
              <p className="text-[10px] text-brand-400 capitalize font-medium">
                {profile?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin" aria-label="Admin navigation">
        <div className="flex flex-col gap-0.5">
          {navItems.map(({ to, i18nKey, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              aria-label={collapsed ? t(`admin_nav.${i18nKey}`) : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                  isActive
                    ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
                    : 'text-dark-100 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-brand-400' : ''}`} aria-hidden="true" />
                  {!collapsed && <span className="text-sm font-medium truncate">{t(`admin_nav.${i18nKey}`)}</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-white/[0.06] flex flex-col gap-1">
        <NavLink
          to="/"
          aria-label={collapsed ? t('admin_nav.customer_view') : undefined}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-dark-100 hover:text-white hover:bg-white/5 transition-all"
        >
          <Eye className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          {!collapsed && <span className="text-sm font-medium">{t('admin_nav.customer_view')}</span>}
        </NavLink>
        <button
          onClick={handleSignOut}
          aria-label={t('admin_nav.sign_out')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all w-full focus-visible:ring-2 focus-visible:ring-red-500/50 focus:outline-none"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          {!collapsed && <span className="text-sm font-medium">{t('admin_nav.sign_out')}</span>}
        </button>
      </div>
    </aside>
  )
}
