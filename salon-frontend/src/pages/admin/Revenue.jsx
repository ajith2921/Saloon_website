import { useState, useMemo } from 'react'
import { DollarSign, ArrowUpRight, ArrowDownRight, FileText } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useFetch } from '../../hooks/useApi'
import { StatCard, Spinner, Button } from '../../components/ui'

export default function Revenue() {
  const { profile } = useAuth()
  const salonId = profile?.db_salon_id ?? profile?.salons?.[0]?.id

  const { data, loading } = useFetch(salonId ? `/api/revenue/salon/${salonId}` : null)

  // Date range filter
  const [range, setRange] = useState('all') // all | today | week | month

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const allTxs = data?.transactions ?? []

  // Client-side date filter
  const txs = (() => {
    if (range === 'all') return allTxs
    const now = new Date()
    const startOf = (days) => new Date(now.getTime() - days * 86400000)
    return allTxs.filter(tx => {
      const d = new Date(tx.date)
      if (range === 'today') return d.toDateString() === now.toDateString()
      if (range === 'week')  return d >= startOf(7)
      if (range === 'month') return d >= startOf(30)
      return true
    })
  })()

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
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue &amp; Billing</h1>
          <p className="text-dark-100 text-sm mt-0.5">Track your earnings and platform fees</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Range Filter */}
          <div className="flex bg-surface-tertiary border border-white/10 rounded-xl overflow-hidden text-xs font-medium">
            {[['all','All Time'],['today','Today'],['week','7 Days'],['month','30 Days']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setRange(val)}
                className={`px-3 py-2 transition-colors ${
                  range === val ? 'bg-brand-500 text-white' : 'text-dark-100 hover:text-white hover:bg-white/5'
                }`}
              >{label}</button>
            ))}
          </div>
          <Button variant="secondary" onClick={handleDownload} disabled={txs.length === 0} className="text-sm" icon={FileText}>
            Download
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <StatCard label="Today's Revenue" value={`₹${data?.today_revenue ?? 0}`} icon={DollarSign} color="green" />
        <StatCard label="This Week" value={`₹${data?.week_revenue ?? 0}`} icon={ArrowUpRight} color="brand" />
        <StatCard label="Platform Fees (Current)" value={`₹${data?.platform_fees ?? 0}`} icon={ArrowDownRight} color="purple" />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-white">Recent Transactions</h2>
          <span className="text-xs text-dark-200">{txs.length} transaction{txs.length !== 1 ? 's' : ''}</span>
        </div>
        {txs.length === 0 ? (
          <div className="py-12 text-center text-dark-200 text-sm">
            No transactions found for this period.
          </div>
        ) : (
          <>
            {/* Mobile Cards (Phone) */}
            <div className="sm:hidden divide-y divide-white/[0.06]">
              {txs.map((tx) => (
                <div key={tx.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white text-sm truncate">{tx.service}</p>
                    <p className="text-xs text-dark-200 mt-0.5">{new Date(tx.date).toLocaleDateString()} · {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <span className="badge bg-green-500/15 text-green-400 mt-1.5 text-[10px]">{tx.status}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-brand-400 text-base">₹{tx.amount}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (Laptop & Desktop) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[500px]">
                <thead>
                  <tr className="bg-surface-tertiary text-dark-200">
                    <th className="p-4 font-medium">Date &amp; Time</th>
                    <th className="p-4 font-medium">Service</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {txs.map((tx) => (
                    <tr key={tx.id} className="text-white hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-dark-100 whitespace-nowrap">{new Date(tx.date).toLocaleString()}</td>
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
          </>
        )}
      </div>
    </div>
  )
}
