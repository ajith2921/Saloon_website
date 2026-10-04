import { useState, useMemo } from 'react'
import { Star, Search, Filter } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useFetch } from '../../hooks/useApi'
import { Spinner, EmptyState, Input } from '../../components/ui'

function StarRow({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-dark-300'}`} />
      ))}
    </div>
  )
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Ratings() {
  const { profile } = useAuth()
  const salonId = profile?.db_salon_id ?? profile?.salons?.[0]?.id

  const { data, loading } = useFetch(salonId ? `/api/ratings/salon/${salonId}` : null)
  const ratings = data?.ratings ?? []

  // Filters
  const [search, setSearch] = useState('')
  const [minStar, setMinStar] = useState(0) // 0 = all

  const filtered = useMemo(() => {
    return ratings.filter(r => {
      const matchStar = minStar === 0 || r.rating === minStar
      const matchSearch =
        !search.trim() ||
        (r.profiles?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.review ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.workers?.name ?? '').toLowerCase().includes(search.toLowerCase())
      return matchStar && matchSearch
    })
  }, [ratings, search, minStar])

  const avgRating = ratings.length > 0
    ? (ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length).toFixed(1)
    : '0.0'

  // Rating distribution
  const dist = [5,4,3,2,1].map(n => ({
    n,
    count: ratings.filter(r => r.rating === n).length,
    pct: ratings.length ? Math.round((ratings.filter(r => r.rating === n).length / ratings.length) * 100) : 0,
  }))

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Ratings &amp; Reviews</h1>
          <p className="text-dark-100 text-sm mt-0.5">Customer feedback for your salon</p>
        </div>
        <div className="flex items-center gap-3 bg-surface-tertiary px-4 py-2 rounded-xl">
          <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
          <div>
            <p className="text-lg font-bold text-white leading-none">{avgRating}</p>
            <p className="text-xs text-dark-200">{ratings.length} reviews</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : ratings.length === 0 ? (
        <EmptyState icon={Star} title="No ratings yet" description="When customers rate your services, they will appear here." />
      ) : (
        <>
          {/* Rating Distribution Card */}
          <div className="card p-5 mb-6">
            <h2 className="text-sm font-bold text-white mb-4">Rating Breakdown</h2>
            <div className="space-y-2">
              {dist.map(({ n, count, pct }) => (
                <button
                  key={n}
                  onClick={() => setMinStar(minStar === n ? 0 : n)}
                  className={`w-full flex items-center gap-3 group rounded-lg px-2 py-1 transition-colors ${minStar === n ? 'bg-amber-500/10' : 'hover:bg-white/[0.03]'}`}
                >
                  <span className={`text-xs font-medium w-4 text-right shrink-0 ${minStar === n ? 'text-amber-400' : 'text-dark-200'}`}>{n}</span>
                  <Star className={`w-3.5 h-3.5 shrink-0 ${minStar === n ? 'text-amber-400 fill-amber-400' : 'text-dark-300'}`} />
                  <div className="flex-1 h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-dark-200 w-12 text-right shrink-0">{count} ({pct}%)</span>
                </button>
              ))}
            </div>
            {minStar > 0 && (
              <button
                onClick={() => setMinStar(0)}
                className="mt-3 text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                ✕ Clear filter
              </button>
            )}
          </div>

          {/* Search */}
          <div className="mb-5">
            <Input
              icon={Search}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by customer, barber, or review text..."
            />
          </div>

          {/* Results count */}
          <p className="text-xs text-dark-200 mb-3">
            Showing {filtered.length} of {ratings.length} reviews
            {minStar > 0 && ` · ${minStar}★ filter active`}
          </p>

          {/* Review Cards */}
          {filtered.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-dark-100 text-sm">No reviews match your filters.</p>
              <button onClick={() => { setSearch(''); setMinStar(0) }} className="mt-3 text-xs text-brand-400 hover:underline">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filtered.map(r => (
                <div key={r.id} className="card p-5">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-tertiary flex items-center justify-center font-bold text-white shrink-0">
                        {r.profiles?.full_name?.[0] ?? 'C'}
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{r.profiles?.full_name ?? 'Customer'}</p>
                        <p className="text-xs text-dark-200">{formatDate(r.created_at)}</p>
                      </div>
                    </div>
                    <StarRow rating={r.rating} />
                  </div>
                  {r.review && (
                    <p className="text-dark-100 text-sm italic leading-relaxed">"{r.review}"</p>
                  )}
                  {r.workers?.name && (
                    <div className="mt-3 pt-3 border-t border-white/[0.06] text-xs text-dark-200">
                      Barber: <span className="font-medium text-white">{r.workers.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
