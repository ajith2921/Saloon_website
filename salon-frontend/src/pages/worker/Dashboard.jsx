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
  const { tokens, loading, refetch, updateTokenOptimistic, queryClient, endpoint } = useRealtimeQueue(salonId, undefined, true)
  const { success, error: showError, warning: showWarning } = useToast()
  
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

  const updateStatus = async (tokenId, action, tokenData = null) => {
    setActionLoading(tokenId)

    const actionToStatus = {
      call: 'called',
      start: 'serving',
      complete: 'completed',
      skip: 'skipped',
    }

    const nextStatus = actionToStatus[action]
    const previousTokens = queryClient?.getQueryData([endpoint]) || tokens

    // 1. Instant 0ms Optimistic UI update
    if (nextStatus && updateTokenOptimistic) {
      updateTokenOptimistic(tokenId, (prev) => ({
        ...prev,
        status: nextStatus,
        ...(action === 'call' ? { called_at: new Date().toISOString() } : {}),
        ...(action === 'start' ? { started_at: new Date().toISOString() } : {}),
        ...(action === 'complete' ? { completed_at: new Date().toISOString() } : {}),
      }))
    }

    try {
      const res = await api.put(`/api/tokens/${tokenId}/${action}`)
      const tokenNumber = tokenData?.token_number ? `#${tokenData.token_number}` : 'Token'

      // 2. Patch cache with authoritative response
      if (res.data && updateTokenOptimistic) {
        updateTokenOptimistic(tokenId, res.data)
      }

      // 3. Immediately background refetch
      refetch()

      if (action === 'call') {
        const smsStatus = res.data?.sms_status
        const smsPhone = res.data?.sms_phone || tokenData?.guest_phone || tokenData?.profiles?.phone

        if (smsStatus === 'opted_out') {
          showWarning(
            `${tokenNumber} called! Notice: Customer has disabled SMS notifications in their profile settings.`,
            'Called (SMS Opted Out)'
          )
        } else if (smsStatus === 'no_phone' || (!smsPhone && smsStatus !== 'sent')) {
          showWarning(
            `${tokenNumber} called! Notice: Customer did not provide a phone number, so no SMS notification could be sent. Please call customer in person.`,
            'Called (No Phone Number)'
          )
        } else if (smsStatus === 'sent' || smsPhone) {
          success(
            `${tokenNumber} called! SMS notification sent${smsPhone ? ` to ${smsPhone}` : ''}.`,
            'Customer Called'
          )
        } else {
          success(`${tokenNumber} called successfully.`, 'Token Called')
        }
      } else {
        const actionLabels = {
          start: 'started',
          complete: 'completed',
          skip: 'skipped',
        }
        success(`${tokenNumber} ${actionLabels[action] || action} successfully`)
      }
    } catch (err) {
      // 4. Roll back on error
      if (queryClient && endpoint) {
        queryClient.setQueryData([endpoint], previousTokens)
      }
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
    <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6 pb-20 sm:pb-8">
      <PageHeader 
        title={`Welcome, ${workerProfile.name}`}
        description="Here are the tokens assigned to you today."
      />

      {/* Serving Now */}
      <Card>
        <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Serving Now</h2>
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
                  <div className="relative flex flex-col sm:flex-row justify-between sm:items-center gap-3.5">
                    <div className="flex items-center gap-3">
                      <TokenBadge number={token.token_number} status={token.status} size="lg" />
                      <div className="min-w-0">
                        <p className="font-bold text-white text-base truncate">{token.profiles?.full_name || token.guest_name || 'Guest'}</p>
                        <p className="text-xs sm:text-sm text-brand-300 truncate">{token.services_summary || token.services?.name}</p>
                      </div>
                    </div>
                    <Button
                      size="md"
                      variant="primary"
                      loading={actionLoading === token.id}
                      onClick={() => updateStatus(token.id, 'complete')}
                      className="w-full sm:w-auto py-2.5 sm:py-2 text-sm font-bold shadow-glow-gold active:scale-[0.98] shrink-0"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Complete Service
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
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-bold text-white">Up Next</h2>
          <span className="text-xs sm:text-sm font-semibold text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-full">{waitingTokens.length} waiting</span>
        </div>
        
        <div className="space-y-2.5 sm:space-y-3">
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
                  className="flex items-center justify-between p-3.5 sm:p-4 bg-surface-secondary/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <TokenBadge number={token.token_number} status={token.status} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white text-sm truncate">
                        {token.profiles?.full_name || token.guest_name || 'Guest'}
                      </p>
                      <p className="text-xs text-dark-200 truncate">
                        {token.services_summary || token.services?.name}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant={token.status === 'called' ? 'primary' : 'outline'}
                      loading={actionLoading === token.id}
                      onClick={() => updateStatus(token.id, token.status === 'called' ? 'start' : 'call', token)}
                      className="px-3.5 py-2 text-xs font-semibold active:scale-95"
                    >
                      {token.status === 'called' ? (
                        <><Play className="w-3.5 h-3.5 mr-1" /> Serve</>
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
