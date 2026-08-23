import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { TrendingUp, Users, Clock, CheckCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useFetch } from '../../hooks/useApi'
import { StatCard, Spinner } from '../../components/ui'

export default function Analytics() {
  const { profile } = useAuth()
  const salonId = profile?.salons?.[0]?.id

  const { data, loading } = useFetch(salonId ? `/api/analytics/salon/${salonId}/summary` : null)
  
  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const chartData = data?.chart_data ?? []

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-white mb-6">Analytics Dashboard</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Customers" value={data?.total_customers_today ?? 0} icon={Users} color="brand" />
        <StatCard label="Avg Wait Time" value={`${data?.avg_wait_time ?? 0}m`} icon={Clock} color="amber" />
        <StatCard label="Completion Rate" value={`${data?.completion_rate ?? 0}%`} icon={CheckCircle} color="green" />
        <StatCard label="Active Barbers" value={data?.active_barbers ?? 0} icon={TrendingUp} color="purple" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Customers Chart */}
        <div className="card p-5 h-80">
          <h2 className="text-sm font-bold text-white mb-4">Customer Footfall (Last 7 Days)</h2>
          
          {/* Screen reader only data table */}
          <table className="sr-only">
            <caption>Customer Footfall Data for Last 7 Days</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Customers</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d, i) => (
                <tr key={i}>
                  <td>{d.name}</td>
                  <td>{d.customers}</td>
                </tr>
              ))}
            </tbody>
          </table>

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
        </div>

        {/* Wait Time Chart */}
        <div className="card p-5 h-80">
          <h2 className="text-sm font-bold text-white mb-4">Avg Wait Time (Minutes)</h2>
          
          {/* Screen reader only data table */}
          <table className="sr-only">
            <caption>Average Wait Time Data for Last 7 Days</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Average Wait Time (Minutes)</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d, i) => (
                <tr key={i}>
                  <td>{d.name}</td>
                  <td>{d.wait_time}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div aria-hidden="true" className="h-[calc(100%-2rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="wait_time" stroke="#c084fc" strokeWidth={3} dot={{ r: 4, fill: '#18181b', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
