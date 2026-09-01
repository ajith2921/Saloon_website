import { useState } from 'react'
import { Plus, Play, Check, SkipForward, RefreshCw, Volume2, UserPlus, UserCog } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useRealtimeQueue } from '../../hooks/useRealtime'
import { useSalonServices, useSalonWorkers } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { TokenBadge, PageHeader, Card, Button, Skeleton, Modal, Input, Select } from '../../components/ui'
import NoSalonEmptyState from '../../components/ui/NoSalonEmptyState'
import api from '../../lib/api'

export default function QueueManagement() {
  const { profile } = useAuth()
  // db_salon_id is set by the backend profile resolution and is authoritative
  const salonId = profile?.db_salon_id ?? profile?.salons?.[0]?.id
  // adminMode=true → uses /queue/admin (authenticated) which includes profiles(full_name)
  const { tokens, activeTokens, waitingTokens, bookingTokens, loading, refetch } = useRealtimeQueue(salonId, undefined, true)
  const { success, error: showError } = useToast()
  const [actionLoading, setActionLoading] = useState(null)

  const { data: servicesData } = useSalonServices(salonId)
  const { data: workersData } = useSalonWorkers(salonId)
  
  const services = servicesData?.services ?? []
  const workers = workersData?.workers ?? []

  const [walkInModalOpen, setWalkInModalOpen] = useState(false)
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [targetToken, setTargetToken] = useState(null)
  
  const [walkInForm, setWalkInForm] = useState({ guest_name: '', guest_phone: '', service_id: '', worker_id: '' })
  const [reassignWorkerId, setReassignWorkerId] = useState('')

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

  const handleWalkInSubmit = async (e) => {
    e.preventDefault()
    if (!walkInForm.guest_name || !walkInForm.service_id) return showError("Name and service are required")
    try {
      await api.post('/api/tokens', {
        salon_id: salonId,
        service_id: walkInForm.service_id,
        worker_id: walkInForm.worker_id || null,
        guest_name: walkInForm.guest_name,
        guest_phone: walkInForm.guest_phone || null
      })
      success("Walk-in token added")
      setWalkInModalOpen(false)
      setWalkInForm({ guest_name: '', guest_phone: '', service_id: '', worker_id: '' })
    } catch (err) {
      showError(err.message || "Failed to create walk-in token")
    }
  }

  const handleReassignSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/api/tokens/${targetToken.id}/reassign`, {
        worker_id: reassignWorkerId || null
      })
      success("Token reassigned successfully")
      setReassignModalOpen(false)
      setTargetToken(null)
    } catch (err) {
      showError(err.message || "Failed to reassign token")
    }
  }

  if (!salonId && !loading) return <NoSalonEmptyState />

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
          <div className="flex gap-2">
            <Button onClick={() => setWalkInModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" /> Add Walk-in
            </Button>
            <Button variant="icon" onClick={refetch} aria-label="Refresh Queue" title="Refresh Queue">
              <RefreshCw className="w-5 h-5" />
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Col: Currently Serving & Called */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          <Card className="p-5 border-brand-500/30 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-radial from-brand-500/5 to-transparent pointer-events-none" />
            <h2 className="text-sm font-bold text-dark-100 uppercase tracking-wider mb-4 relative z-10">Currently Active</h2>
            
            {activeTokens.length === 0 ? (
              <p className="text-dark-200 text-sm py-4 text-center relative z-10">No tokens currently active.</p>
            ) : (
              <div className="flex flex-col gap-4 relative z-10">
                <AnimatePresence>
                  {activeTokens.map((t) => (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="bg-surface-tertiary border border-white/[0.08] rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 shadow-sm"
                    >
                      <div className="flex-shrink-0 text-center">
                        <p className="text-4xl font-bold text-white leading-none">#{t.token_number}</p>
                        <div className="mt-2"><TokenBadge status={t.status} /></div>
                      </div>
                      
                      <div className="flex-1 min-w-0 text-center sm:text-left">
                        <p className="font-semibold text-white">{t.guest_name || t.profiles?.full_name || 'Walk-in Customer'}</p>
                        <p className="text-sm text-dark-100">{t.services?.name} · {t.services?.duration_minutes}m</p>
                        <p className="text-xs text-dark-200 mt-1 flex items-center justify-center sm:justify-start gap-2">
                          <span>Assigned to: <span className="text-white font-medium">{t.workers?.name ?? 'Any'}</span></span>
                          {(t.status === 'waiting' || t.status === 'called') && (
                            <button 
                              onClick={() => { setTargetToken(t); setReassignWorkerId(t.worker_id || ''); setReassignModalOpen(true); }}
                              className="text-[10px] bg-white/5 hover:bg-white/10 text-brand-400 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                            >
                              <UserCog className="w-3 h-3" /> Reassign
                            </button>
                          )}
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
                    </motion.div>
                  ))}
                </AnimatePresence>
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
                      <td className="py-3">{t.guest_name || t.profiles?.full_name || '—'}</td>
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
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin overflow-x-hidden">
            {waitingTokens.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-dark-200 text-sm">Queue is empty</p>
              </div>
            ) : (
              <AnimatePresence>
                {waitingTokens.map((t) => (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="bg-surface-tertiary border border-white/[0.06] rounded-xl p-3 flex items-center gap-3 group transition-colors hover:border-white/20"
                  >
                    <div className="w-10 h-10 rounded-lg bg-surface-primary flex items-center justify-center font-bold text-white border border-white/5 shadow-inner">
                      {t.token_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{t.guest_name || t.profiles?.full_name || 'Walk-in'}</p>
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
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            
            {bookingTokens?.length > 0 && (
              <>
                <h3 className="text-xs font-bold text-dark-200 uppercase tracking-wider mt-6 mb-2 px-1">Upcoming Appointments</h3>
                <AnimatePresence>
                  {bookingTokens.map((t) => (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20, scale: 0.9 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3 flex items-center gap-3 group transition-colors hover:border-brand-500/30"
                    >
                      <div className="w-10 h-10 rounded-lg bg-surface-primary flex items-center justify-center font-bold text-brand-400 border border-white/5 shadow-inner">
                        {t.token_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{t.guest_name || t.profiles?.full_name || 'Walk-in'}</p>
                        <p className="text-[10px] text-brand-300 font-medium">
                          {new Date(t.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {t.services?.name}
                        </p>
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
                    </motion.div>
                  ))}
                </AnimatePresence>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Add Walk-in Modal */}
      <Modal 
        isOpen={walkInModalOpen} 
        onClose={() => setWalkInModalOpen(false)} 
        title="Add Walk-in Token"
      >
        <form onSubmit={handleWalkInSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1">Customer Name *</label>
            <input
              type="text"
              className="w-full bg-dark-500 border border-dark-400 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500 transition-colors"
              placeholder="E.g. John Doe"
              value={walkInForm.guest_name}
              onChange={(e) => setWalkInForm({ ...walkInForm, guest_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1">Phone Number (Optional)</label>
            <input
              type="text"
              className="w-full bg-dark-500 border border-dark-400 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500 transition-colors"
              placeholder="E.g. +1234567890"
              value={walkInForm.guest_phone}
              onChange={(e) => setWalkInForm({ ...walkInForm, guest_phone: e.target.value })}
            />
            <p className="text-xs text-dark-200 mt-1">For SMS notifications when token is called</p>
          </div>
          <Select
            label="Service"
            value={walkInForm.service_id}
            onChange={(e) => setWalkInForm({ ...walkInForm, service_id: e.target.value })}
            options={[
              { value: '', label: 'Select a Service' },
              ...services.map(s => ({ value: s.id, label: s.name }))
            ]}
            required
          />
          <Select
            label="Preferred Barber (Optional)"
            value={walkInForm.worker_id}
            onChange={(e) => setWalkInForm({ ...walkInForm, worker_id: e.target.value })}
            options={[
              { value: '', label: 'Any Available' },
              ...workers.map(w => ({ value: w.id, label: w.name }))
            ]}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-6">
            <Button type="button" variant="ghost" onClick={() => setWalkInModalOpen(false)}>Cancel</Button>
            <Button type="submit">Add Walk-in</Button>
          </div>
        </form>
      </Modal>

      {/* Reassign Modal */}
      <Modal 
        isOpen={reassignModalOpen} 
        onClose={() => setReassignModalOpen(false)} 
        title="Reassign Token"
      >
        <form onSubmit={handleReassignSubmit} className="space-y-4">
          <div className="bg-surface-tertiary p-3 rounded-lg border border-white/5 mb-4">
            <p className="text-sm text-white">Token: <span className="font-bold">#{targetToken?.token_number}</span></p>
            <p className="text-sm text-dark-100">Customer: {targetToken?.guest_name || targetToken?.profiles?.full_name || 'Walk-in'}</p>
          </div>
          <Select
            label="Assign To"
            value={reassignWorkerId}
            onChange={(e) => setReassignWorkerId(e.target.value)}
            options={[
              { value: '', label: 'Any Available' },
              ...workers.map(w => ({ value: w.id, label: w.name }))
            ]}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-6">
            <Button type="button" variant="ghost" onClick={() => setReassignModalOpen(false)}>Cancel</Button>
            <Button type="submit">Reassign</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
