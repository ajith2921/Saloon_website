import { useState, useEffect } from 'react'
import { Play, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useRealtimeQueue } from '../../hooks/useRealtime'
import { useToast } from '../../context/ToastContext'
import { TokenBadge, PageHeader, Card, Button, Skeleton } from '../../components/ui'
import api from '../../lib/api'

export default function WorkerDashboard() {
  const { profile } = useAuth()
  const salonId = profile?.db_salon_id ?? profile?.salons?.[0]?.id
  // Fetch real-time queue in admin mode
  const { tokens, loading, refetch } = useRealtimeQueue(salonId, undefined, true)
  const { success, error: showError } = useToast()
  
  const [workerProfile, setWorkerProfile] = useState(null)
  const [loadingWorker, setLoadingWorker] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    const fetchWorker = async () => {
      try {
        const res = await api.get('/api/workers/me')
        setWorkerProfile(res.data)
      } catch (err) {
        showError("Could not load worker profile")
      } finally {
        setLoadingWorker(false)
      }
    }
    fetchWorker()
  }, [])

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

  if (loading || loadingWorker) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader title="My Queue" description="Loading assignments..." />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!workerProfile) {
    return (
      <div className="max-w-5xl mx-auto text-center py-12 text-dark-200">
        Worker profile not found.
      </div>
    )
  }

  // Filter tokens assigned to this specific worker
  const myTokens = tokens.filter(t => t.worker_id === workerProfile.id)
  
  const activeTokens = myTokens.filter(t => t.status === 'serving')
  const waitingTokens = myTokens.filter(t => t.status === 'waiting' || t.status === 'called')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader 
        title={`Welcome, ${workerProfile.name}`}
        description="Here are the tokens assigned to you today."
      />

      {/* Serving Now */}
      <Card>
        <h2 className="text-lg font-semibold text-dark-100 mb-4">Serving Now</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {activeTokens.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="col-span-full py-8 text-center text-dark-200 bg-surface-secondary/50 rounded-xl border border-white/5"
              >
                You are not serving anyone right now.
              </motion.div>
            ) : (
              activeTokens.map((token) => (
                <motion.div
                  key={token.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-4 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-500/10 to-transparent opacity-50" />
                  <div className="relative flex justify-between items-start">
                    <div>
                      <TokenBadge number={token.token_number} status={token.status} size="lg" />
                      <div className="mt-2 space-y-1">
                        <p className="font-medium text-dark-100">{token.profiles?.full_name || token.guest_name || 'Guest'}</p>
                        <p className="text-sm text-brand-300">{token.services?.name}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={actionLoading === token.id}
                      onClick={() => updateStatus(token.id, 'complete')}
                      className="shrink-0"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Complete
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* Up Next */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-dark-100">Up Next</h2>
          <span className="text-sm text-dark-200">{waitingTokens.length} waiting</span>
        </div>
        
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {waitingTokens.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-8 text-center text-dark-200 bg-surface-secondary/50 rounded-xl border border-white/5"
              >
                No tokens assigned to you are currently waiting.
              </motion.div>
            ) : (
              waitingTokens.map((token) => (
                <motion.div
                  key={token.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center justify-between p-4 bg-surface-secondary/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <TokenBadge number={token.token_number} status={token.status} />
                    <div>
                      <p className="font-medium text-dark-100">
                        {token.profiles?.full_name || token.guest_name || 'Guest'}
                      </p>
                      <p className="text-sm text-dark-200">
                        {token.services?.name}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={token.status === 'called' ? 'primary' : 'outline'}
                      loading={actionLoading === token.id}
                      onClick={() => updateStatus(token.id, token.status === 'called' ? 'serve' : 'call')}
                    >
                      {token.status === 'called' ? (
                        <><Play className="w-4 h-4 mr-2" /> Serve</>
                      ) : (
                        'Call'
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </Card>
    </div>
  )
}
