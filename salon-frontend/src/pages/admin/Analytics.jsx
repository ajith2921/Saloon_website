import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { TrendingUp, Users, Clock, CheckCircle, Download } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useFetch } from '../../hooks/useApi'
import { StatCard, Spinner, Card, Button } from '../../components/ui'
import NoSalonEmptyState from '../../components/ui/NoSalonEmptyState'

export default function Analytics() {
  const { profile } = useAuth()
  const salonId = profile?.salons?.[0]?.id

  const { data, loading } = useFetch(salonId ? `/api/analytics/salon/${salonId}/summary` : null)
  
  if (!salonId && !loading) return <NoSalonEmptyState />
  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const chartData = data?.chart_data ?? []
  const topServices = data?.top_services ?? []
  const topWorkers = data?.top_workers ?? []

  const handleExportCSV = () => {
    // Generate CSV string
    let csvContent = "data:text/csv;charset=utf-8,"
    csvContent += "Day,Customers,Revenue,WaitTime\n"
    chartData.forEach(row => {
      csvContent += `${row.name},${row.customers},${row.revenue},${row.wait_time}\n`
    })
    
    // Download
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "queuecut_analytics.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
        <Button size="sm" variant="secondary" onClick={handleExportCSV} className="flex items-center gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Customers" value={data?.total_customers_today ?? 0} icon={Users} color="brand" />
        <StatCard label="Avg Wait Time" value={`${data?.avg_wait_time ?? 0}m`} icon={Clock} color="amber" />
        <StatCard label="Completion Rate" value={`${data?.completion_rate ?? 0}%`} icon={CheckCircle} color="green" />
        <StatCard label="Active Barbers" value={data?.active_barbers ?? 0} icon={TrendingUp} color="purple" />
      </div>

      {/* Main Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        
        {/* Revenue Chart */}
        <Card className="p-5 h-80">
          <h2 className="text-sm font-bold text-white mb-4">Revenue (Last 7 Days)</h2>
          <div aria-hidden="true" className="h-[calc(100%-2rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                <Tooltip cursor={{ fill: '#27272a' }} contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Customer Footfall Chart */}
        <Card className="p-5 h-80">
          <h2 className="text-sm font-bold text-white mb-4">Customer Footfall (Last 7 Days)</h2>
          <div aria-hidden="true" className="h-[calc(100%-2rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#27272a' }} contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
                <Bar dataKey="customers" fill="#eab308" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top Performers Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Top Services */}
        <Card className="p-5">
          <h2 className="text-sm font-bold text-white mb-4">Top Services (7 Days)</h2>
          {topServices.length === 0 ? (
            <p className="text-dark-200 text-sm">No services completed this week.</p>
          ) : (
            <ul className="space-y-4">
              {topServices.map(s => (
                <li key={s.name} className="flex justify-between items-center">
                  <span className="text-sm text-dark-100">{s.name}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">₹{s.revenue.toFixed(2)}</p>
                    <p className="text-xs text-dark-300">{s.count} bookings</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Top Workers */}
        <Card className="p-5">
          <h2 className="text-sm font-bold text-white mb-4">Top Barbers (7 Days)</h2>
          {topWorkers.length === 0 ? (
            <p className="text-dark-200 text-sm">No barber activity this week.</p>
          ) : (
            <ul className="space-y-4">
              {topWorkers.map(w => (
                <li key={w.name} className="flex justify-between items-center">
                  <span className="text-sm text-dark-100">{w.name}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">₹{w.revenue.toFixed(2)}</p>
                    <p className="text-xs text-dark-300">{w.count} served</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

      </div>
    </div>
  )
}
