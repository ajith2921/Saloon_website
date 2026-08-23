import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Scissors, Home, MapPin, Ticket, History, User,
  Bell, LogOut, Menu, X, ChevronDown, Star, Gift,
  LayoutDashboard
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/',             label: 'Home',        icon: Home },
  { to: '/salons',       label: 'Find Salons',  icon: MapPin },
  { to: '/my-token',     label: 'My Token',     icon: Ticket,   auth: true },
  { to: '/history',      label: 'History',      icon: History,  auth: true },
  { to: '/loyalty',      label: 'Rewards',      icon: Gift,     auth: true, role: 'customer' },
]

export default function CustomerNavbar() {
  const { user, profile, signOut, isOwner, isWorker, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled]       = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileBtnRef = useRef(null)
  const profileMenuRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Close profile dropdown on Escape
  useEffect(() => {
    if (!profileOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setProfileOpen(false)
        profileBtnRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [profileOpen])

  // Close profile dropdown when clicking outside
  useEffect(() => {
    if (!profileOpen) return
    const handleClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target) &&
          profileBtnRef.current && !profileBtnRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [profileOpen])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const adminLink = isOwner || isWorker
    ? '/admin'
    : isSuperAdmin
    ? '/super-admin'
    : null

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'bg-surface-primary/90 backdrop-blur-xl border-b border-white/[0.06] shadow-card'
            : 'bg-transparent'
        }`}
      >
        <div className="container-app flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group" aria-label="QueueCut — Men's Salon Platform, go to home">
            <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm group-hover:shadow-glow-gold transition-shadow" aria-hidden="true">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block" aria-hidden="true">
              <span className="font-bold text-white text-base tracking-tight">QueueCut</span>
              <span className="block text-[10px] text-dark-200 -mt-0.5 tracking-wider uppercase">Men's Salon Platform</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {navItems.map(({ to, label, icon: Icon, auth, role }) => {
              if (auth && !user) return null
              if (role && profile?.role !== role) return null
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'text-white bg-white/8'
                        : 'text-dark-100 hover:text-white hover:bg-white/5'
                    }`
                  }
                  aria-current={({ isActive }) => isActive ? 'page' : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <Icon className="w-4 h-4" aria-hidden="true" />
                      {label}
                      {isActive && <span className="sr-only">(current page)</span>}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {/* Notifications bell */}
                <Link
                  to="/notifications"
                  className="btn-icon relative"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" aria-hidden="true" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-surface-primary" aria-hidden="true" />
                </Link>

                {/* Profile dropdown */}
                <div className="relative" ref={profileMenuRef}>
                  <button
                    ref={profileBtnRef}
                    id="profile-menu-button"
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-tertiary border border-white/10 hover:border-white/20 transition-all focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none"
                    aria-expanded={profileOpen}
                    aria-haspopup="true"
                    aria-controls="profile-dropdown-menu"
                    aria-label={`User menu for ${profile?.full_name?.split(' ')[0] ?? 'User'}`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-gradient-brand flex items-center justify-center text-xs font-bold text-white" aria-hidden="true">
                      {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-white max-w-[100px] truncate" aria-hidden="true">
                      {profile?.full_name?.split(' ')[0] ?? 'User'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-dark-200" aria-hidden="true" />
                  </button>

                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} aria-hidden="true" />
                      <div
                        id="profile-dropdown-menu"
                        role="menu"
                        aria-labelledby="profile-menu-button"
                        className="absolute right-0 top-full mt-2 w-52 card p-1.5 z-20 animate-fade-in"
                      >
                        <div className="px-3 py-2 mb-1" role="none">
                          <p className="text-sm font-semibold text-white truncate">{profile?.full_name}</p>
                          <p className="text-xs text-dark-200 truncate">{user.email}</p>
                          <span className="inline-block mt-1 text-[10px] uppercase tracking-wider font-semibold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full">
                            {profile?.role?.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="divider my-1" role="none" />
                        <Link
                          to="/profile"
                          role="menuitem"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-dark-100 hover:text-white hover:bg-white/5 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none"
                          onClick={() => setProfileOpen(false)}
                        >
                          <User className="w-4 h-4" aria-hidden="true" /> Profile
                        </Link>
                        {profile?.loyalty_points > 0 && (
                          <Link
                            to="/loyalty"
                            role="menuitem"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-dark-100 hover:text-white hover:bg-white/5 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none"
                            onClick={() => setProfileOpen(false)}
                          >
                            <Star className="w-4 h-4" aria-hidden="true" /> {profile.loyalty_points} points
                          </Link>
                        )}
                        {adminLink && (
                          <>
                            <div className="divider my-1" role="none" />
                            <Link
                              to={adminLink}
                              role="menuitem"
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none"
                              onClick={() => setProfileOpen(false)}
                            >
                              <LayoutDashboard className="w-4 h-4" aria-hidden="true" /> Dashboard
                            </Link>
                          </>
                        )}
                        <div className="divider my-1" role="none" />
                        <button
                          role="menuitem"
                          onClick={() => { setProfileOpen(false); handleSignOut() }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-red-500/50 focus:outline-none"
                        >
                          <LogOut className="w-4 h-4" aria-hidden="true" /> Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login"    className="btn-ghost text-sm">Sign In</Link>
                <Link to="/register" className="btn-primary text-sm">Get Started</Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden btn-icon focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-menu"
            >
              {mobileOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div
            id="mobile-nav-menu"
            className="absolute top-16 inset-x-0 bg-surface-secondary border-b border-white/[0.08] p-4 animate-slide-up"
          >
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {navItems.map(({ to, label, icon: Icon, auth }) => {
                if (auth && !user) return null
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        isActive ? 'text-white bg-surface-tertiary' : 'text-dark-100'
                      }`
                    }
                    aria-current={({ isActive }) => isActive ? 'page' : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className="w-5 h-5" aria-hidden="true" />
                        {label}
                        {isActive && <span className="sr-only">(current page)</span>}
                      </>
                    )}
                  </NavLink>
                )
              })}
              {!user && (
                <div className="flex gap-2 mt-2 pt-3 border-t border-white/[0.06]">
                  <Link to="/login"    className="btn-secondary flex-1 justify-center">Sign In</Link>
                  <Link to="/register" className="btn-primary flex-1 justify-center">Get Started</Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="h-16" aria-hidden="true" />
    </>
  )
}
