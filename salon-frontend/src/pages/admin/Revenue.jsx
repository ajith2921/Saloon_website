import { DollarSign, ArrowUpRight, ArrowDownRight, FileText } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useFetch } from '../../hooks/useApi'
import { StatCard, Spinner, Button } from '../../components/ui'

export default function Revenue() {
  const { profile } = useAuth()
  const salonId = profile?.salons?.[0]?.id

  const { data, loading } = useFetch(salonId ? `/api/revenue/salon/${salonId}` : null)
  
  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const txs = data?.transactions ?? []

  const handleDownload = () => {
    if (!txs.length) return
    const headers = ['Date & Time', 'Service', 'Status', 'Amount']
    const csv = [
      headers.join(','),
      ...txs.map(tx => [
        `"${new Date(tx.date).toLocaleString().replace(/"/g, '""')}"`,
        `"${tx.service.replace(/"/g, '""')}"`,
        tx.status,
        tx.amount
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `revenue_report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue & Billing</h1>
          <p className="text-dark-100 text-sm mt-0.5">Track your earnings and platform fees</p>
        </div>
        <Button variant="secondary" onClick={handleDownload} disabled={txs.length === 0} className="text-sm" icon={FileText}>
          Download Report
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Today's Revenue" value={`₹${data?.today_revenue ?? 0}`} icon={DollarSign} color="green" />
        <StatCard label="This Week" value={`₹${data?.week_revenue ?? 0}`} icon={ArrowUpRight} color="brand" />
        <StatCard label="Platform Fees (Current)" value={`₹${data?.platform_fees ?? 0}`} icon={ArrowDownRight} color="purple" />
      </div>

      <div className="card p-0">
        <div className="p-5 border-b border-white/[0.06]">
          <h2 className="text-base font-bold text-white">Recent Transactions</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-surface-tertiary text-dark-200">
              <th className="p-4 font-medium">Date & Time</th>
              <th className="p-4 font-medium">Service</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {txs.map((tx) => (
              <tr key={tx.id} className="text-white hover:bg-white/[0.02] transition-colors">
                <td className="p-4 text-dark-100">{new Date(tx.date).toLocaleString()}</td>
                <td className="p-4">{tx.service}</td>
                <td className="p-4">
                  <span className="badge bg-green-500/15 text-green-400">{tx.status}</span>
                </td>
                <td className="p-4 text-right font-bold text-brand-400">₹{tx.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
