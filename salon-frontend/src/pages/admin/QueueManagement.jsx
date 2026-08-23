import { useState } from 'react'
import { Play, Check, SkipForward, RefreshCw, Volume2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useRealtimeQueue } from '../../hooks/useRealtime'
import { useToast } from '../../context/ToastContext'
import { TokenBadge, PageHeader, Card, Button, Skeleton } from '../../components/ui'
import api from '../../lib/api'

export default function QueueManagement() {
  const { profile } = useAuth()
  // db_salon_id is set by the backend profile resolution and is authoritative
  const salonId = profile?.db_salon_id ?? profile?.salons?.[0]?.id
  // adminMode=true → uses /queue/admin (authenticated) which includes profiles(full_name)
  const { tokens, activeTokens, waitingTokens, loading, refetch } = useRealtimeQueue(salonId, undefined, true)
  const { success, error: showError } = useToast()
  const [actionLoading, setActionLoading] = useState(null)

  const updateStatus = async (tokenId, action) => {
    setActionLoading(tokenId)
    try {
      await api.put(`/api/tokens/${tokenId}/${action}`)
      success(`Token ${action} successfully`)
    } catch (err) {
      showError(err.message || `Failed to ${action} token`)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return (
    <div className="max-w-5xl mx-auto">
      <PageHeader 
        title="Live Queue Management"
        description="Control token flow and assignments"
      />
      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div>
          <Skeleton className="h-[calc(100vh-10rem)] w-full" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader 
        title="Live Queue Management"
        description="Control token flow and assignments"
        action={
          <Button variant="icon" onClick={refetch} aria-label="Refresh Queue" title="Refresh Queue">
            <RefreshCw className="w-5 h-5" />
          </Button>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Col: Currently Serving & Called */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          <Card className="p-5 border-brand-500/30">
            <h2 className="text-sm font-bold text-dark-100 uppercase tracking-wider mb-4">Currently Active</h2>
            
            {activeTokens.length === 0 ? (
              <p className="text-dark-200 text-sm py-4 text-center">No tokens currently active.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {activeTokens.map((t) => (
                  <div key={t.id} className="bg-surface-tertiary border border-white/[0.08] rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex-shrink-0 text-center">
                      <p className="text-4xl font-bold text-white leading-none">#{t.token_number}</p>
                      <div className="mt-2"><TokenBadge status={t.status} /></div>
                    </div>
                    
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                      <p className="font-semibold text-white">{t.profiles?.full_name ?? 'Walk-in Customer'}</p>
                      <p className="text-sm text-dark-100">{t.services?.name} · {t.services?.duration_minutes}m</p>
                      <p className="text-xs text-dark-200 mt-1">
                        Assigned to: <span className="text-white font-medium">{t.workers?.name ?? 'Any'}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap sm:flex-col justify-center gap-2 w-full sm:w-auto">
                      {t.status === 'called' && (
                        <Button
                          onClick={() => updateStatus(t.id, 'start')}
                          loading={actionLoading === t.id}
                          className="flex-1 sm:w-32 py-2"
                          aria-label={`Start serving token ${t.token_number}`}
                        >
                          <Play className="w-4 h-4 mr-1" aria-hidden="true" /> Start
                        </Button>
                      )}
                      {t.status === 'serving' && (
                        <Button
                          variant="secondary"
                          onClick={() => updateStatus(t.id, 'complete')}
                          loading={actionLoading === t.id}
                          className="flex-1 sm:w-32 py-2 !border-green-500/40 !text-green-400 hover:!bg-green-500/10"
                          aria-label={`Complete token ${t.token_number}`}
                        >
                          <Check className="w-4 h-4 mr-1" aria-hidden="true" /> Complete
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() => updateStatus(t.id, 'skip')}
                        loading={actionLoading === t.id}
                        className="flex-1 sm:w-32 py-2 !text-dark-200 hover:!text-purple-400"
                        aria-label={`Skip token ${t.token_number}`}
                      >
                        <SkipForward className="w-4 h-4 mr-1" aria-hidden="true" /> Skip
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-bold text-dark-100 uppercase tracking-wider mb-4">Completed Today</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Tokens completed or skipped today</caption>
                <thead>
                  <tr className="text-dark-200 border-b border-white/[0.06]">
                    <th scope="col" className="pb-2 font-medium">Token</th>
                    <th scope="col" className="pb-2 font-medium">Customer</th>
                    <th scope="col" className="pb-2 font-medium">Service</th>
                    <th scope="col" className="pb-2 font-medium">Barber</th>
                    <th scope="col" className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {tokens.filter(t => ['completed', 'skipped', 'cancelled'].includes(t.status)).reverse().slice(0, 5).map(t => (
                    <tr key={t.id} className="text-dark-100">
                      <td className="py-3 font-medium text-white">#{t.token_number}</td>
                      <td className="py-3">{t.profiles?.full_name ?? '—'}</td>
                      <td className="py-3">{t.services?.name ?? '—'}</td>
                      <td className="py-3">{t.workers?.name ?? '—'}</td>
                      <td className="py-3"><TokenBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Col: Waiting Queue */}
        <Card className="p-0 flex flex-col lg:h-[calc(100vh-10rem)] lg:sticky lg:top-24 max-h-[500px] lg:max-h-none">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between bg-surface-tertiary rounded-t-2xl">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Waiting ({waitingTokens.length})</h2>
            {waitingTokens.length > 0 && (
              <Button 
                onClick={() => updateStatus(waitingTokens[0].id, 'call')}
                loading={actionLoading === waitingTokens[0].id}
                className="py-1.5 px-3 text-xs h-auto"
                aria-label={`Call next token: ${waitingTokens[0].token_number}`}
              >
                Call Next <Volume2 className="w-3 h-3 ml-1" aria-hidden="true" />
              </Button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {waitingTokens.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-dark-200 text-sm">Queue is empty</p>
              </div>
            ) : (
              waitingTokens.map((t) => (
                <div key={t.id} className="bg-surface-tertiary border border-white/[0.06] rounded-xl p-3 flex items-center gap-3 group transition-colors hover:border-white/20">
                  <div className="w-10 h-10 rounded-lg bg-surface-primary flex items-center justify-center font-bold text-white border border-white/5 shadow-inner">
                    {t.token_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{t.profiles?.full_name ?? 'Walk-in'}</p>
                    <p className="text-xs text-dark-200 truncate">{t.services?.name}</p>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="secondary"
                      onClick={() => updateStatus(t.id, 'call')}
                      loading={actionLoading === t.id}
                      disabled={actionLoading !== null}
                      className="px-2 py-1 text-[10px] h-auto"
                      aria-label={`Call token ${t.token_number}`}
                    >
                      Call
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
