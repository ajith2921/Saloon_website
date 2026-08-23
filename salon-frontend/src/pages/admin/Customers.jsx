import { Users, Phone, Calendar, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSalonCustomers } from '../../hooks/useApi'
import { EmptyState, TokenBadge, Skeleton, PageHeader, Button, Input } from '../../components/ui'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function avatar(name) {
  return (name || 'C').charAt(0).toUpperCase()
}

export default function Customers() {
  const { profile } = useAuth()
  const salonId = profile?.salons?.[0]?.id

  const { data, loading, refetch } = useSalonCustomers(salonId)
  const customers = data?.customers ?? []

  const [search, setSearch] = useState('')

  const filtered = customers.filter(c =>
    !search.trim() ||
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Customers"
        subtitle={`Customers who have visited your salon · ${customers.length} total`}
        action={
          <Button variant="icon" onClick={refetch} aria-label="Refresh" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        }
      />

      {/* Search */}
      <div className="mb-6">
        <Input
          icon={Search}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
        />
      </div>


      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Customers who get tokens at your salon will appear here."
        />
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-dark-100 text-sm">No customers match "{search}"</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-surface-tertiary text-dark-200 border-b border-white/[0.06]">
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Phone</th>
                <th className="p-4 font-medium">Last Visit</th>
                <th className="p-4 font-medium">Last Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-surface-tertiary border border-white/10 flex-shrink-0 flex items-center justify-center font-bold text-white text-sm">
                        {c.avatar_url
                          ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                          : avatar(c.full_name)
                        }
                      </div>
                      <p className="font-medium text-white">{c.full_name}</p>
                    </div>
                  </td>
                  <td className="p-4 text-dark-100">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3" />
                      {c.phone || '—'}
                    </span>
                  </td>
                  <td className="p-4 text-dark-100">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {formatDate(c.last_visit)}
                    </span>
                  </td>
                  <td className="p-4">
                    <TokenBadge status={c.last_token_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
