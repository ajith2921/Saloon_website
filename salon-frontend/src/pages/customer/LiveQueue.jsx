import { useParams } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useRealtimeQueue } from '../../hooks/useRealtime'
import { useSalon } from '../../hooks/useApi'
import { TokenBadge, Spinner } from '../../components/ui'

export default function LiveQueue() {
  const { salonId } = useParams()
  const { data: salon } = useSalon(salonId)
  const { tokens, waitingTokens, loading } = useRealtimeQueue(salonId)

  const servingTokens = tokens.filter((t) => t.status === 'serving')
  const calledTokens  = tokens.filter((t) => t.status === 'called')

  return (
    <div className="container-app max-w-2xl mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white leading-tight">Live Queue</h1>
          <p className="text-dark-100 text-sm mt-1">{salon?.name}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-bold text-success uppercase tracking-widest">Live</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Currently Serving */}
          <div className="card p-6 mb-6 border-2 border-brand-500/20 bg-gradient-card shadow-glow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-radial from-brand-500/10 to-transparent pointer-events-none" />
            <p className="text-[10px] font-semibold text-dark-200 uppercase tracking-widest mb-4 relative z-10">Now Serving</p>
            {servingTokens.length === 0 && calledTokens.length === 0 ? (
              <p className="text-dark-100 text-sm relative z-10">No one is currently being served.</p>
            ) : (
              <div className="flex flex-wrap gap-4 relative z-10">
                {[...servingTokens, ...calledTokens].map((t) => (
                  <div key={t.id} className="flex items-center gap-4 bg-surface-primary/60 border border-white/5 rounded-2xl px-5 py-4">
                    <p className="text-4xl sm:text-5xl font-display font-black text-white leading-none">#{t.token_number}</p>
                    <div>
                      <TokenBadge status={t.status} />
                      {t.workers?.name && (
                        <p className="text-xs font-medium text-dark-200 mt-2">with <span className="text-white">{t.workers.name}</span></p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Waiting */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-dark-200 uppercase tracking-wider">
                Waiting ({waitingTokens.length})
              </p>
              <div className="flex items-center gap-1 text-xs text-dark-200">
                <Clock className="w-3 h-3" />
                ~{waitingTokens.length * (salon?.avg_service_minutes ?? 30)}m total
              </div>
            </div>
            {waitingTokens.length === 0 ? (
              <p className="text-dark-100 text-sm">Queue is empty — no wait time!</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {waitingTokens.map((t, i) => (
                  <div key={t.id} className="flex flex-col items-center gap-1.5">
                    <div className="w-14 h-14 rounded-2xl bg-surface-primary border border-white/[0.06] flex items-center justify-center shadow-sm">
                      <span className="font-display font-bold text-white text-lg leading-none">#{t.token_number}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-dark-300 uppercase tracking-wider">#{i + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
