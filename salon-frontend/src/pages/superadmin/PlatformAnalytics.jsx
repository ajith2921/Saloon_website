import { useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Building2, Users, Ticket, TrendingUp, RefreshCw, Store, Activity, MapPin } from 'lucide-react'
import { useFetch } from '../../hooks/useApi'
import { StatCard, PageHeader, Card, Button, Skeleton, ErrorState, DateRangePicker } from '../../components/ui'

const STATUS_COLORS = {
  Active:    '#22c55e',
  Pending:   '#eab308',
  Suspended: '#ef4444',
  Other:     '#6b7280',
}

/** Custom pie tooltip */
function PieTooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-surface-secondary border border-white/10 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="text-white font-semibold">{name}</p>
      <p className="text-dark-100">{value} salon{value !== 1 ? 's' : ''}</p>
    </div>
  )
}

/** Skeleton for stat cards */
function StatsSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[100px]" />
      ))}
    </div>
  )
}

/** Skeleton for charts section */
function ChartsSkeleton() {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  )
}

export default function PlatformAnalytics() {
  const [dateRange, setDateRange] = useState('30d')
  const { data, loading, error, refetch } = useFetch(`/api/super-admin/stats?range=${dateRange}`)

  // Derived pie data
  const salonStatusData = [
    { name: 'Active',    value: data?.active_salons ?? 0 },
    { name: 'Pending',   value: data?.pending_approvals ?? 0 },
    { name: 'Other',     value: Math.max(0, (data?.total_salons ?? 0) - (data?.active_salons ?? 0) - (data?.pending_approvals ?? 0)) },
  ].filter(d => d.value > 0)

  // Avg revenue per active salon
  const avgRevenue = data?.active_salons
    ? Math.round((data.platform_revenue_month ?? 0) / data.active_salons)
    : null

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Platform Analytics"
        subtitle="Live platform-wide metrics across all salons"
        action={
          <div className="flex items-center gap-4">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <Button
              variant="icon"
              onClick={refetch}
              aria-label="Refresh analytics"
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </Button>
          </div>
        }
      />

      {/* Stats row */}
      {loading ? (
        <>
          <StatsSkeleton />
          <ChartsSkeleton />
        </>
      ) : error ? (
        <Card className="p-6">
          <ErrorState
            title="Failed to load analytics"
            message={error}
            onRetry={refetch}
          />
        </Card>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Salons"    value={data?.total_salons ?? 0}                                      icon={Building2}  color="brand" />
            <StatCard label="Active Salons"   value={data?.active_salons ?? 0}                                     icon={Store}      color="green" />
            <StatCard label="Tokens Today"    value={(data?.total_tokens_today ?? 0).toLocaleString()}             icon={Ticket}     color="amber" />
            <StatCard label="Revenue (Month)" value={`₹${(data?.platform_revenue_month ?? 0).toLocaleString()}`}  icon={TrendingUp} color="green" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Salon status breakdown */}
            <Card className="p-5">
              <h2 className="text-sm font-bold text-white mb-5 uppercase tracking-wider">Salon Status Distribution</h2>
              
              {/* Screen reader only data table */}
              <table className="sr-only">
                <caption>Salon Status Distribution</caption>
                <thead>
                  <tr>
                    <th scope="col">Status</th>
                    <th scope="col">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {salonStatusData.map((d) => (
                    <tr key={d.name}>
                      <td>{d.name}</td>
                      <td>{d.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {salonStatusData.length === 0 ? (
                <p className="text-dark-200 text-sm text-center py-10">No salon data available yet.</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6" aria-hidden="true">
                  {/* Chart — fully responsive */}
                  <div className="w-full sm:w-[180px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={salonStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          dataKey="value"
                          stroke="none"
                        >
                          {salonStatusData.map((entry) => (
                            <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? STATUS_COLORS.Other} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-col gap-3 w-full">
                    {salonStatusData.map((entry) => {
                      const total = data?.total_salons ?? 1
                      const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
                      return (
                        <div key={entry.name} className="flex items-center gap-2.5">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: STATUS_COLORS[entry.name] ?? STATUS_COLORS.Other }}
                          />
                          <span className="text-sm text-dark-100 flex-1">{entry.name}</span>
                          <span className="text-xs text-dark-300">{pct}%</span>
                          <span className="text-sm font-bold text-white w-6 text-right">{entry.value}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </Card>

            {/* Platform metrics */}
            <Card className="p-5">
              <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Platform Metrics</h2>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Total Registered Customers',  value: (data?.total_customers ?? 0).toLocaleString(),  icon: Users },
                  { label: 'Active Salons',               value: data?.active_salons ?? 0,                       icon: Store },
                  { label: 'Pending Approvals',           value: data?.pending_approvals ?? 0,                    icon: Activity },
                  { label: 'Tokens Issued Today',         value: (data?.total_tokens_today ?? 0).toLocaleString(), icon: Ticket },
                  { label: 'Revenue This Month',          value: `₹${(data?.platform_revenue_month ?? 0).toLocaleString()}`, icon: TrendingUp },
                  ...(avgRevenue !== null
                    ? [{ label: 'Avg Revenue / Active Salon', value: `₹${avgRevenue.toLocaleString()}`, icon: TrendingUp }]
                    : []
                  ),
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex justify-between items-center pb-3 border-b border-white/[0.06] last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-dark-300" aria-hidden="true" />
                      <span className="text-sm text-dark-100">{label}</span>
                    </div>
                    <span className="text-sm font-bold text-white">{value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Time Series Chart */}
          <div className="mt-6">
            <Card className="p-5">
              <h2 className="text-sm font-bold text-white mb-6 uppercase tracking-wider">Revenue & Tokens (Timeline)</h2>
              
              {(!data?.time_series || data.time_series.length === 0) ? (
                <div className="h-64 flex items-center justify-center border-t border-white/5 mt-4">
                  <p className="text-dark-200 text-sm">No timeline data available for this range.</p>
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.time_series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d4821e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#d4821e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="date" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                      <YAxis yAxisId="right" orientation="right" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#ffffff10', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#22c55e" fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                      <Area yAxisId="right" type="monotone" dataKey="tokens" stroke="#d4821e" fillOpacity={1} fill="url(#colorTokens)" name="Tokens Issued" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* Top Salons Table */}
          <div className="mt-6">
            <Card className="p-0 overflow-hidden">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Top Performing Salons</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-dark-100">
                  <thead className="text-xs uppercase bg-surface-secondary text-dark-200">
                    <tr>
                      <th className="px-5 py-3 font-medium">Salon</th>
                      <th className="px-5 py-3 font-medium">Location</th>
                      <th className="px-5 py-3 font-medium text-right">Tokens</th>
                      <th className="px-5 py-3 font-medium text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!data?.top_salons || data.top_salons.length === 0) ? (
                      <tr>
                        <td colSpan="4" className="px-5 py-10 text-center text-dark-200">No top salon data available.</td>
                      </tr>
                    ) : (
                      data.top_salons.map((salon) => (
                        <tr key={salon.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-4 font-medium text-white flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0 text-brand-400 font-bold">
                              {salon.name[0]}
                            </div>
                            {salon.name}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5 text-xs">
                              <MapPin className="w-3 h-3" /> {salon.city}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-white">{salon.total_tokens}</td>
                          <td className="px-5 py-4 text-right font-bold text-green-400">₹{salon.revenue}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
