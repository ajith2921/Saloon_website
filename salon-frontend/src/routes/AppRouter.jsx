import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute, GuestRoute } from './guards'
import LoadingScreen from '../components/ui/LoadingScreen'

// Layouts — always eagerly loaded (thin wrappers, no heavy deps)
import CustomerLayout from '../layouts/CustomerLayout'
import AdminLayout    from '../layouts/AdminLayout'
import SuperAdminLayout from '../layouts/SuperAdminLayout'

// Auth pages — small, eagerly loaded (hit on every cold start)
import Login    from '../pages/auth/Login'
import Register from '../pages/auth/Register'
import ResetPassword from '../pages/auth/ResetPassword'

// ─── Customer pages ───────────────────────────────────────────────────────────
// Home, FindSalons, SalonDetails are the most commonly visited on cold start.
// Keep them eager so the majority of customers never see a lazy-loading flash.
import Home         from '../pages/customer/Home'
import FindSalons   from '../pages/customer/FindSalons'
import SalonDetails from '../pages/customer/SalonDetails'

// Less-frequently visited customer pages — lazy-loaded.
const GetToken      = lazy(() => import('../pages/customer/GetToken'))
const MyToken       = lazy(() => import('../pages/customer/MyToken'))
const LiveQueue     = lazy(() => import('../pages/customer/LiveQueue'))
const History       = lazy(() => import('../pages/customer/History'))
const RateBarber    = lazy(() => import('../pages/customer/RateBarber'))
const Profile       = lazy(() => import('../pages/customer/Profile'))
const Notifications = lazy(() => import('../pages/customer/Notifications'))
const Loyalty       = lazy(() => import('../pages/customer/Loyalty'))

// ─── Admin pages — always lazy-loaded ────────────────────────────────────────
// Customers never download admin code. Analytics pulls in Recharts (~400 KB).
const AdminDashboard  = lazy(() => import('../pages/admin/Dashboard'))
const QueueManagement = lazy(() => import('../pages/admin/QueueManagement'))
const Workers         = lazy(() => import('../pages/admin/Workers'))
const Services        = lazy(() => import('../pages/admin/Services'))
const Customers       = lazy(() => import('../pages/admin/Customers'))
const Ratings         = lazy(() => import('../pages/admin/Ratings'))
const Revenue         = lazy(() => import('../pages/admin/Revenue'))
const Analytics       = lazy(() => import('../pages/admin/Analytics'))
const Advertisements  = lazy(() => import('../pages/admin/Advertisements'))
const Settings        = lazy(() => import('../pages/admin/Settings'))
const Subscription    = lazy(() => import('../pages/admin/Subscription'))

// ─── Super Admin pages — always lazy-loaded ───────────────────────────────────
// PlatformAnalytics imports Recharts — splitting keeps it out of every user bundle.
const SuperDashboard     = lazy(() => import('../pages/superadmin/Dashboard'))
const SuperSalons        = lazy(() => import('../pages/superadmin/Salons'))
const SuperSubscriptions = lazy(() => import('../pages/superadmin/Subscriptions'))
const SuperAds           = lazy(() => import('../pages/superadmin/Advertisements'))
const PlatformAnalytics  = lazy(() => import('../pages/superadmin/PlatformAnalytics'))

// ─── Role constants ───────────────────────────────────────────────────────────
const ADMIN_ROLES    = ['salon_owner', 'worker']
const OWNER_ROLES    = ['salon_owner']
const SUPER_ROLES    = ['super_admin']
const CUSTOMER_ROLES = ['customer']
const ALL_ROLES      = ['customer', 'worker', 'salon_owner', 'super_admin']

// Reuse the existing branded LoadingScreen as the Suspense fallback.
function PageLoader() {
  return <LoadingScreen />
}

export default function AppRouter() {
  return (
    <Routes>
      {/* ─── Auth ─── */}
      <Route path="/login"    element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* ─── Customer (public + auth) ─── */}
      <Route element={<CustomerLayout />}>
        {/* Eagerly loaded — critical path for every visitor */}
        <Route index               element={<Home />} />
        <Route path="/salons"      element={<FindSalons />} />
        <Route path="/salons/:salonId" element={<SalonDetails />} />

        {/* Public lazy */}
        <Route path="/queue/:salonId" element={
          <Suspense fallback={<PageLoader />}><LiveQueue /></Suspense>
        } />

        {/* Protected customer routes — lazy */}
        <Route path="/salons/:salonId/token" element={
          <ProtectedRoute roles={CUSTOMER_ROLES}>
            <Suspense fallback={<PageLoader />}><GetToken /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/my-token" element={
          <ProtectedRoute roles={ALL_ROLES}>
            <Suspense fallback={<PageLoader />}><MyToken /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute roles={ALL_ROLES}>
            <Suspense fallback={<PageLoader />}><History /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/rate/:tokenId" element={
          <ProtectedRoute roles={CUSTOMER_ROLES}>
            <Suspense fallback={<PageLoader />}><RateBarber /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute roles={ALL_ROLES}>
            <Suspense fallback={<PageLoader />}><Profile /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute roles={ALL_ROLES}>
            <Suspense fallback={<PageLoader />}><Notifications /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/loyalty" element={
          <ProtectedRoute roles={CUSTOMER_ROLES}>
            <Suspense fallback={<PageLoader />}><Loyalty /></Suspense>
          </ProtectedRoute>
        } />
      </Route>

      {/* ─── Admin ─── */}
      <Route path="/admin" element={
        <ProtectedRoute roles={ADMIN_ROLES}><AdminLayout /></ProtectedRoute>
      }>
        <Route index        element={
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute roles={OWNER_ROLES}><AdminDashboard /></ProtectedRoute>
          </Suspense>
        } />
        <Route path="queue" element={
          <Suspense fallback={<PageLoader />}><QueueManagement /></Suspense>
        } />
        <Route path="workers" element={
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute roles={OWNER_ROLES}><Workers /></ProtectedRoute>
          </Suspense>
        } />
        <Route path="services" element={
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute roles={OWNER_ROLES}><Services /></ProtectedRoute>
          </Suspense>
        } />
        <Route path="customers" element={
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute roles={OWNER_ROLES}><Customers /></ProtectedRoute>
          </Suspense>
        } />
        <Route path="ratings" element={
          <Suspense fallback={<PageLoader />}><Ratings /></Suspense>
        } />
        <Route path="revenue" element={
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute roles={OWNER_ROLES}><Revenue /></ProtectedRoute>
          </Suspense>
        } />
        <Route path="analytics" element={
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute roles={OWNER_ROLES}><Analytics /></ProtectedRoute>
          </Suspense>
        } />
        <Route path="advertisements" element={
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute roles={OWNER_ROLES}><Advertisements /></ProtectedRoute>
          </Suspense>
        } />
        <Route path="settings" element={
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute roles={OWNER_ROLES}><Settings /></ProtectedRoute>
          </Suspense>
        } />
        <Route path="subscription" element={
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute roles={OWNER_ROLES}><Subscription /></ProtectedRoute>
          </Suspense>
        } />
      </Route>

      {/* ─── Super Admin ─── */}
      <Route path="/super-admin" element={
        <ProtectedRoute roles={SUPER_ROLES}><SuperAdminLayout /></ProtectedRoute>
      }>
        <Route index               element={
          <Suspense fallback={<PageLoader />}><SuperDashboard /></Suspense>
        } />
        <Route path="salons"       element={
          <Suspense fallback={<PageLoader />}><SuperSalons /></Suspense>
        } />
        <Route path="subscriptions" element={
          <Suspense fallback={<PageLoader />}><SuperSubscriptions /></Suspense>
        } />
        <Route path="advertisements" element={
          <Suspense fallback={<PageLoader />}><SuperAds /></Suspense>
        } />
        <Route path="analytics"    element={
          <Suspense fallback={<PageLoader />}><PlatformAnalytics /></Suspense>
        } />
      </Route>

      {/* ─── Catch-all ─── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
