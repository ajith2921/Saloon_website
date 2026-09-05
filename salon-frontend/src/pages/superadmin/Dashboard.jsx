import { ShieldCheck, Building2, Users, DollarSign, Activity, CheckCircle, RefreshCw, Ticket, Store } from 'lucide-react'
import { useFetch } from '../../hooks/useApi'
import { StatCard, PageHeader, Card, Button, Skeleton, ErrorState } from '../../components/ui'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import { useState } from 'react'
import { useToast } from '../../context/ToastContext'

/** Skeleton for the stat cards row */
function StatsSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[100px]" />
      ))}
    </div>
  )
}

/** Skeleton for a pending-salon card */
function PendingCardSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-xl border border-white/[0.06]">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="flex gap-2 flex-shrink-0 ml-3">
        <Skeleton className="h-8 w-16 rounded-xl" />
        <Skeleton className="h-8 w-20 rounded-xl" />
      </div>
    </div>
  )
}

/** Individual pending-salon action card */
function PendingSalonCard({ salon, onAction }) {
  const [loading, setLoading] = useState(false)
  const { success, error: showError } = useToast()

  const handleApprove = async () => {
    setLoading(true)
    try {
      await api.post(`/api/super-admin/salons/${salon.id}/approve`)
      success(`${salon.name} approved successfully`)
      onAction()
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to approve salon')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-xl border border-white/[0.06]">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white truncate">{salon.name}</p>
        <p className="text-xs text-dark-200">
          {salon.city || '—'} · {salon.profiles?.full_name ?? 'Unknown owner'}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0 ml-3">
        <Button
          as={Link}
          to="/super-admin/salons"
          variant="ghost"
          size="sm"
          className="text-xs"
        >
          Review
        </Button>
        <Button
          onClick={handleApprove}
          loading={loading}
          size="sm"
          className="text-xs"
          aria-label={`Approve ${salon.name}`}
        >
          <CheckCircle className="w-3 h-3 mr-1" /> Approve
        </Button>
      </div>
    </div>
  )
}

/** Card for granting a free setup by email */
function GrantFreeSetupCard() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const { success, error: showError } = useToast()

  const handleGrant = async (e) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      await api.post('/api/super-admin/grant-free-setup', { email })
      success(`Free setup granted to ${email}`)
      setEmail('')
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to grant free setup')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Ticket className="w-5 h-5 text-brand-400" />
        <h2 className="text-base font-bold text-white">Grant Free Setup</h2>
      </div>
      <p className="text-sm text-dark-200 mb-4">
        Allow a user to set up their salon for free. They will bypass the subscription payment.
      </p>
      <form onSubmit={handleGrant} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          placeholder="Enter user email..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-background border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
          required
        />
        <Button type="submit" loading={loading} disabled={!email}>
          Grant Access
        </Button>
      </form>
    </Card>
  )
}

export default function Dashboard() {
  const { data, loading, error, refetch } = useFetch('/api/super-admin/stats')
  const { data: pendingData, loading: pendingLoading, error: pendingError, refetch: refetchPending } = useFetch('/api/super-admin/salons/pending')

  const pendingSalons = pendingData?.salons ?? []

  const handleAction = () => {
    refetch()
    refetchPending()
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-purple-400" />
            Super Admin Console
          </div>
        }
        subtitle="Platform overview and management"
        action={
          <Button
            variant="icon"
            onClick={handleAction}
            aria-label="Refresh dashboard"
            disabled={loading && pendingLoading}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      {/* ── Stats Section ── */}
      {loading ? (
        <StatsSkeleton />
      ) : error ? (
        <Card className="p-6 mb-8">
          <ErrorState
            title="Failed to load platform stats"
            message={error}
            onRetry={refetch}
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Salons"      value={data?.total_salons ?? 0}                                           icon={Building2}  color="brand" />
          <StatCard label="Active Salons"     value={data?.active_salons ?? 0}                                          icon={Store}      color="green" />
          <StatCard label="Pending Approval"  value={data?.pending_approvals ?? 0}                                      icon={Activity}   color="amber" />
          <StatCard label="Total Customers"   value={(data?.total_customers ?? 0).toLocaleString()}                    icon={Users}      color="purple" />
          <StatCard label="Tokens Today"      value={(data?.total_tokens_today ?? 0).toLocaleString()}                 icon={Ticket}     color="brand" />
          <StatCard label="Revenue (Month)"   value={`₹${(data?.platform_revenue_month ?? 0).toLocaleString()}`}     icon={DollarSign} color="green" />
        </div>
      )}

      {/* ── Lower section ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Pending Approvals */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">Pending Approvals</h2>
            <Link to="/super-admin/salons" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
              View All Salons →
            </Link>
          </div>

          {pendingLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <PendingCardSkeleton key={i} />)}
            </div>
          ) : pendingError ? (
            <ErrorState
              title="Failed to load pending salons"
              message={pendingError}
              onRetry={refetchPending}
            />
          ) : pendingSalons.length === 0 ? (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <p className="text-sm text-green-400 font-medium">All salons are reviewed — no pending approvals.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingSalons.map(salon => (
                <PendingSalonCard key={salon.id} salon={salon} onAction={handleAction} />
              ))}
            </div>
          )}
        </Card>

        {/* Grant Free Setup */}
        <GrantFreeSetupCard />
        </div>

        {/* Platform snapshot */}
        <Card className="p-5">
          <h2 className="text-base font-bold text-white mb-4">Platform Snapshot</h2>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : error ? null : (
            <div className="space-y-4">
              {[
                {
                  label: 'Active Salons',
                  value: `${data?.active_salons ?? 0} of ${data?.total_salons ?? 0} total`,
                  color: 'text-green-400 bg-green-500/15',
                },
                {
                  label: 'Pending Approval',
                  value: `${data?.pending_approvals ?? 0} salons`,
                  color: data?.pending_approvals > 0 ? 'text-amber-400 bg-amber-500/15' : 'text-dark-200 bg-white/5',
                },
                {
                  label: 'Customers',
                  value: `${(data?.total_customers ?? 0).toLocaleString()} registered`,
                  color: 'text-purple-400 bg-purple-500/15',
                },
                {
                  label: 'Tokens Today',
                  value: `${(data?.total_tokens_today ?? 0).toLocaleString()} issued`,
                  color: 'text-brand-400 bg-brand-500/15',
                },
                {
                  label: 'Revenue This Month',
                  value: `₹${(data?.platform_revenue_month ?? 0).toLocaleString()}`,
                  color: 'text-green-400 bg-green-500/15',
                },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-sm text-dark-100">{label}</span>
                  <span className={`badge ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
