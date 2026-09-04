import { useLocation } from 'react-router-dom'
import { Users, Ticket, CheckCircle, TrendingUp, AlertTriangle, RefreshCw, DollarSign, CalendarClock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSalonStats } from '../../hooks/useApi'
import { StatCard, PageHeader, Card, Button, Skeleton } from '../../components/ui'
import NoSalonEmptyState from '../../components/ui/NoSalonEmptyState'

export default function Dashboard() {
  const { profile, loading: authLoading } = useAuth()
  const { state } = useLocation()
  // db_salon_id is resolved by the backend profile query (authoritative)
  // fallback to salons[0] for legacy compatibility, and newSalonId from nav state
  // for the brief window before async refreshProfile() resolves after registration.
  const salonId = profile?.db_salon_id ?? profile?.salons?.[0]?.id ?? state?.newSalonId

  const { data: stats, loading, refetch } = useSalonStats(salonId)

  if (!salonId && !loading && !authLoading) return <NoSalonEmptyState />

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader 
        title="Overview"
        action={
          <Button variant="icon" onClick={refetch} aria-label="Refresh stats" title="Refresh stats">
            <RefreshCw className="w-5 h-5" />
          </Button>
        }
      />

      {loading ? (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            <StatCard
              label="Queue (Active)"
              value={stats?.waiting ?? 0}
              icon={Ticket}
              color="amber"
            />
            <StatCard
              label="Currently Serving"
              value={stats?.serving ?? 0}
              icon={Users}
              color="brand"
            />
            <StatCard
              label="Completed Today"
              value={stats?.completed_today ?? 0}
              icon={CheckCircle}
              color="green"
            />
            <StatCard
              label="Avg Rating"
              value={stats?.avg_rating ? `${stats.avg_rating}★` : '—'}
              icon={TrendingUp}
              color="purple"
            />
            <StatCard
              label="Today's Revenue"
              value={stats?.today_revenue != null ? `₹${stats.today_revenue}` : '—'}
              icon={DollarSign}
              color="green"
            />
            <StatCard
              label="Upcoming Bookings"
              value={stats?.upcoming_bookings ?? 0}
              icon={CalendarClock}
              color="brand"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <h2 className="text-base font-bold text-white mb-4">Today's Summary</h2>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Total tokens issued today', value: stats?.total_today ?? 0 },
                  { label: 'Completed services', value: stats?.completed_today ?? 0 },
                  { label: 'Customers in queue', value: stats?.waiting ?? 0 },
                  { label: 'Currently being served', value: stats?.serving ?? 0 },
                  { label: "Today's Revenue", value: stats?.today_revenue != null ? `₹${stats.today_revenue}` : '—' },
                  { label: 'Upcoming Appointments', value: stats?.upcoming_bookings ?? 0 },
                  { label: 'Total reviews', value: stats?.review_count ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between pb-3 border-b border-white/[0.06] last:border-0 last:pb-0">
                    <p className="text-sm text-dark-100">{label}</p>
                    <p className="text-sm font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-base font-bold text-white mb-4">System Alerts</h2>
              {!salonId ? (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-400 mb-1">Salon Not Linked</p>
                    <p className="text-xs text-dark-100 leading-relaxed">
                      Your account is not linked to a salon. Please contact support or create a salon to get started.
                    </p>
                  </div>
                </div>
              ) : (stats?.waiting ?? 0) > 10 ? (
                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-400 mb-1">High Queue Volume</p>
                    <p className="text-xs text-dark-100 leading-relaxed">
                      Queue has {stats.waiting} customers waiting. Consider activating additional barbers to reduce wait times.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-400 mb-1">All Systems Normal</p>
                    <p className="text-xs text-dark-100 leading-relaxed">
                      Queue is running smoothly. {stats?.waiting ?? 0} customers currently waiting.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
