import { Star } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useFetch } from '../../hooks/useApi'
import { Spinner, EmptyState } from '../../components/ui'

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Ratings() {
  const { profile } = useAuth()
  const salonId = profile?.salons?.[0]?.id

  const { data, loading } = useFetch(salonId ? `/api/ratings/salon/${salonId}` : null)
  const ratings = data?.ratings ?? []

  const avgRating = ratings.length > 0 
    ? (ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length).toFixed(1)
    : '0.0'

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Ratings & Reviews</h1>
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
        <div className="grid gap-4">
          {ratings.map(r => (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-tertiary flex items-center justify-center font-bold text-white">
                    {r.profiles?.full_name?.[0] ?? 'C'}
                  </div>
                  <div>
                    <p className="font-medium text-white text-sm">{r.profiles?.full_name ?? 'Customer'}</p>
                    <p className="text-xs text-dark-200">{formatDate(r.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < r.rating ? 'text-amber-400 fill-amber-400' : 'text-dark-300'}`} />
                  ))}
                </div>
              </div>
              {r.review && (
                <p className="text-dark-100 text-sm italic">"{r.review}"</p>
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
    </div>
  )
}
