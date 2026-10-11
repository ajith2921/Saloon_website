import { Users, Phone, Calendar, RefreshCw, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSalonCustomers } from '../../hooks/useApi'
import { EmptyState, TokenBadge, Skeleton, Button, Input } from '../../components/ui'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function avatar(name) {
  return (name || 'C').charAt(0).toUpperCase()
}

export default function Customers() {
  const { profile } = useAuth()
  const salonId = profile?.db_salon_id ?? profile?.salons?.[0]?.id

  const { data, loading, refetch } = useSalonCustomers(salonId)
  const customers = data?.customers ?? []

  const [search, setSearch] = useState('')

  const filtered = customers.filter(c =>
    !search.trim() ||
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white leading-tight">Customers</h1>
          <p className="text-dark-100 text-xs sm:text-sm mt-0.5">
            {customers.length} customer{customers.length === 1 ? '' : 's'} recorded
          </p>
        </div>
        <Button variant="icon" onClick={refetch} aria-label="Refresh" title="Refresh" className="shrink-0 p-2 sm:p-2.5">
          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative">
        <Input
          icon={Search}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full text-sm pr-10"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-200 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Customers who get tokens at your salon will appear here."
        />
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-dark-100 text-sm">No customers match "{search}"</p>
          <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="mt-3 text-brand-400">
            Clear search
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile Card List (visible on phone/tablet < md) */}
          <div className="md:hidden space-y-3">
            {filtered.map(c => (
              <div 
                key={c.id} 
                className="bg-surface-secondary/90 border border-white/[0.08] rounded-2xl p-4 shadow-sm hover:border-white/20 transition-colors"
              >
                {/* Header: Avatar, Name, Status Badge */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500/20 to-brand-700/20 border border-brand-500/30 flex-shrink-0 flex items-center justify-center font-bold text-brand-300 text-sm shadow-inner">
                      {c.avatar_url
                        ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                        : avatar(c.full_name)
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-base truncate">{c.full_name}</p>
                      <p className="text-[11px] text-dark-200">Customer</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <TokenBadge status={c.last_token_status} />
                  </div>
                </div>

                {/* Contact & Visit Info */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.06] text-xs">
                  <div>
                    <span className="text-dark-200 block text-[11px] mb-1">Phone</span>
                    {c.phone ? (
                      <a
                        href={`tel:${c.phone}`}
                        className="inline-flex items-center gap-1.5 text-brand-400 hover:text-brand-300 font-medium active:scale-95 transition-transform"
                      >
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{c.phone}</span>
                      </a>
                    ) : (
                      <span className="text-dark-200 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-dark-300 shrink-0" />
                        <span>—</span>
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-dark-200 block text-[11px] mb-1">Last Visit</span>
                    <span className="text-dark-100 flex items-center gap-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-dark-200 shrink-0" />
                      <span className="truncate">{formatDate(c.last_visit)}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (visible on md screens and up) */}
          <div className="hidden md:block card p-0 overflow-hidden">
            <div className="overflow-x-auto">
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
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-dark-100 hover:text-brand-400 transition-colors">
                            <Phone className="w-3.5 h-3.5 text-dark-200" />
                            {c.phone}
                          </a>
                        ) : (
                          <span className="flex items-center gap-1.5 text-dark-200">
                            <Phone className="w-3.5 h-3.5" />
                            —
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-dark-100">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-dark-200" />
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
          </div>
        </>
      )}
    </div>
  )
}
