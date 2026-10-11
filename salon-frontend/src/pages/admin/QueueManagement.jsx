import { useState } from 'react'
import { Play, Check, SkipForward, RefreshCw, Volume2, UserPlus, UserCog, X, Phone, PhoneOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useRealtimeQueue } from '../../hooks/useRealtime'
import { useSalonServices, useSalonWorkers } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { TokenBadge, PageHeader, Card, Button, Skeleton, Modal, Select } from '../../components/ui'
import NoSalonEmptyState from '../../components/ui/NoSalonEmptyState'
import api from '../../lib/api'

export default function QueueManagement() {
  const { profile } = useAuth()
  // db_salon_id is set by the backend profile resolution and is authoritative
  const salonId = profile?.db_salon_id ?? profile?.salons?.[0]?.id
  // adminMode=true → uses /queue/admin (authenticated) which includes profiles(full_name, phone)
  const { tokens, activeTokens, waitingTokens, bookingTokens, loading, refetch } = useRealtimeQueue(salonId, undefined, true)
  const { success, error: showError, warning: showWarning } = useToast()
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

  const updateStatus = async (tokenId, action, tokenData = null) => {
    setActionLoading(tokenId)
    try {
      const res = await api.put(`/api/tokens/${tokenId}/${action}`)
      const tokenNumber = tokenData?.token_number ? `#${tokenData.token_number}` : 'Token'

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
          cancel: 'cancelled',
          recall: 'recalled',
        }
        success(`${tokenNumber} ${actionLabels[action] || action} successfully`)
      }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white leading-tight">Live Queue Management</h1>
          <p className="text-dark-100 text-xs sm:text-sm mt-0.5">Control token flow and assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setWalkInModalOpen(true)} className="flex-1 sm:flex-initial py-2 sm:py-2.5 text-xs sm:text-sm">
            <UserPlus className="w-4 h-4 mr-1.5" /> Add Walk-in
          </Button>
          <Button variant="icon" onClick={refetch} aria-label="Refresh Queue" title="Refresh Queue" className="shrink-0 p-2 sm:p-2.5">
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Col: Currently Serving & Called (Order 1 on mobile) */}
        <div className="lg:col-span-2 flex flex-col gap-6 order-1">
          <Card className="p-4 sm:p-5 border-brand-500/30 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-radial from-brand-500/5 to-transparent pointer-events-none" />
            <h2 className="text-xs sm:text-sm font-bold text-dark-100 uppercase tracking-wider mb-3 sm:mb-4 relative z-10">Currently Active</h2>
            
            {tokens.filter(t => ['called', 'serving'].includes(t.status)).length === 0 ? (
              waitingTokens.length > 0 ? (
                <div className="bg-surface-tertiary/50 border border-brand-500/20 rounded-2xl p-4 sm:p-5 text-center relative z-10">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 text-xs font-semibold mb-2.5">
                    Next Waiting: #{waitingTokens[0].token_number}
                  </div>
                  <p className="text-base sm:text-lg font-bold text-white">
                    {waitingTokens[0].guest_name || waitingTokens[0].profiles?.full_name || 'Walk-in Customer'}
                  </p>
                  <p className="text-xs text-dark-100 mt-0.5 mb-2">
                    {waitingTokens[0].services?.name} · {waitingTokens[0].services?.duration_minutes}m · Assigned to <span className="text-white font-medium">{waitingTokens[0].workers?.name ?? 'Any Barber'}</span>
                  </p>
                  <div className="mb-4 flex items-center justify-center">
                    {(waitingTokens[0].guest_phone || waitingTokens[0].profiles?.phone) ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-full border border-brand-500/20">
                        <Phone className="w-3 h-3" /> {waitingTokens[0].guest_phone || waitingTokens[0].profiles?.phone} (SMS enabled)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                        <PhoneOff className="w-3 h-3" /> No phone number (In-person call)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                    <Button
                      onClick={() => updateStatus(waitingTokens[0].id, 'call', waitingTokens[0])}
                      loading={actionLoading === waitingTokens[0].id}
                      className="flex-1 py-2 text-xs sm:text-sm"
                      aria-label={`Call token ${waitingTokens[0].token_number}`}
                    >
                      <Volume2 className="w-4 h-4 mr-1.5" /> Call Customer
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => updateStatus(waitingTokens[0].id, 'skip', waitingTokens[0])}
                      loading={actionLoading === waitingTokens[0].id}
                      className="text-xs sm:text-sm !text-dark-200 hover:!text-purple-400"
                      aria-label={`Skip token ${waitingTokens[0].token_number}`}
                    >
                      <SkipForward className="w-3.5 h-3.5 mr-1" /> Skip
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 relative z-10">
                  <p className="text-dark-200 text-sm">No tokens currently active or waiting.</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setWalkInModalOpen(true)}
                    className="mt-3 text-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1" /> Add Walk-in
                  </Button>
                </div>
              )
            ) : (
              <div className="flex flex-col gap-4 relative z-10">
                <AnimatePresence>
                  {tokens.filter(t => ['called', 'serving'].includes(t.status)).map((t) => (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="bg-surface-tertiary border border-white/[0.08] rounded-2xl p-4 flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between w-full sm:w-auto sm:flex-col sm:justify-center shrink-0">
                        <p className="text-3xl sm:text-4xl font-bold text-white leading-none">#{t.token_number}</p>
                        <div className="sm:mt-2"><TokenBadge status={t.status} /></div>
                      </div>
                      
                      <div className="flex-1 min-w-0 text-center sm:text-left w-full">
                        <p className="font-semibold text-base sm:text-lg text-white truncate">{t.guest_name || t.profiles?.full_name || 'Walk-in Customer'}</p>
                        <p className="text-xs sm:text-sm text-dark-100 mt-0.5">{t.services?.name} · {t.services?.duration_minutes}m</p>
                        {(t.guest_phone || t.profiles?.phone) ? (
                          <p className="text-xs text-brand-400 flex items-center justify-center sm:justify-start gap-1 mt-1 truncate">
                            <Phone className="w-3 h-3 shrink-0" /> {t.guest_phone || t.profiles?.phone}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-400/90 flex items-center justify-center sm:justify-start gap-1 mt-1">
                            <PhoneOff className="w-3 h-3 shrink-0" /> No phone provided
                          </p>
                        )}
                        <div className="text-xs text-dark-200 mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                          <span>Assigned to: <span className="text-white font-medium">{t.workers?.name ?? 'Any'}</span></span>
                          {(t.status === 'waiting' || t.status === 'called') && (
                            <button 
                              onClick={() => { setTargetToken(t); setReassignWorkerId(t.worker_id || ''); setReassignModalOpen(true); }}
                              className="text-[11px] bg-white/5 hover:bg-white/10 text-brand-400 px-2.5 py-0.5 rounded-md flex items-center gap-1 transition-colors border border-white/5 shrink-0"
                            >
                              <UserCog className="w-3 h-3" /> Reassign
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-32 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
                        {t.status === 'called' && (
                          <Button
                            onClick={() => updateStatus(t.id, 'start', t)}
                            loading={actionLoading === t.id}
                            className="flex-1 sm:w-full py-2 text-xs sm:text-sm"
                            aria-label={`Start serving token ${t.token_number}`}
                          >
                            <Play className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Start
                          </Button>
                        )}
                        {t.status === 'serving' && (
                          <Button
                            variant="secondary"
                            onClick={() => updateStatus(t.id, 'complete', t)}
                            loading={actionLoading === t.id}
                            className="flex-1 sm:w-full py-2 text-xs sm:text-sm !border-green-500/40 !text-green-400 hover:!bg-green-500/10"
                            aria-label={`Complete token ${t.token_number}`}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Complete
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => updateStatus(t.id, 'skip', t)}
                          loading={actionLoading === t.id}
                          className="flex-1 sm:w-full py-2 text-xs sm:text-sm !text-dark-200 hover:!text-purple-400"
                          aria-label={`Skip token ${t.token_number}`}
                        >
                          <SkipForward className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Skip
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </Card>
        </div>

        {/* Right Col: Waiting Queue (Order 2 on mobile) */}
        <div className="order-2 lg:order-none">
          <Card className="p-0 flex flex-col lg:h-[calc(100vh-10rem)] lg:sticky lg:top-24 max-h-[500px] lg:max-h-none">
            <div className="p-3.5 sm:p-4 border-b border-white/[0.06] flex items-center justify-between bg-surface-tertiary rounded-t-2xl">
              <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">Waiting ({waitingTokens.length})</h2>
              {waitingTokens.length > 0 && (
                <Button 
                  onClick={() => updateStatus(waitingTokens[0].id, 'call', waitingTokens[0])}
                  loading={actionLoading === waitingTokens[0].id}
                  className="py-1 px-2.5 text-xs h-auto"
                  aria-label={`Call next token: ${waitingTokens[0].token_number}`}
                >
                  Call Next <Volume2 className="w-3 h-3 ml-1" aria-hidden="true" />
                </Button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 scrollbar-thin overflow-x-hidden">
              {waitingTokens.length === 0 ? (
                <div className="text-center py-8">
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
                      className="bg-surface-tertiary border border-white/[0.06] rounded-xl p-3 flex items-center gap-3 transition-colors hover:border-white/20"
                    >
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface-primary flex items-center justify-center font-bold text-white text-sm sm:text-base border border-white/5 shadow-inner shrink-0">
                        {t.token_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-white truncate">{t.guest_name || t.profiles?.full_name || 'Walk-in'}</p>
                        <p className="text-[11px] text-dark-200 truncate">{t.services?.name}</p>
                        {(t.guest_phone || t.profiles?.phone) ? (
                          <p className="text-[10px] text-brand-300 flex items-center gap-1 mt-0.5 truncate">
                            <Phone className="w-2.5 h-2.5 shrink-0" /> {t.guest_phone || t.profiles?.phone}
                          </p>
                        ) : (
                          <p className="text-[10px] text-amber-400/80 flex items-center gap-1 mt-0.5">
                            <PhoneOff className="w-2.5 h-2.5 shrink-0" /> No phone
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button 
                          variant="secondary"
                          onClick={() => updateStatus(t.id, 'call', t)}
                          loading={actionLoading === t.id}
                          disabled={actionLoading !== null}
                          className="px-2.5 py-1 text-xs h-auto"
                          aria-label={`Call token ${t.token_number}`}
                        >
                          Call
                        </Button>
                        <Button 
                          variant="ghost"
                          onClick={() => updateStatus(t.id, 'cancel', t)}
                          loading={actionLoading === t.id}
                          disabled={actionLoading !== null}
                          className="p-1 text-xs h-auto !text-red-400 hover:!bg-red-500/10"
                          aria-label={`Cancel token ${t.token_number}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}

              {/* Upcoming Appointments if any */}
              {bookingTokens?.length > 0 && (
                <>
                  <h3 className="text-xs font-bold text-dark-200 uppercase tracking-wider mt-5 mb-2 px-1">Upcoming Appointments</h3>
                  <AnimatePresence>
                    {bookingTokens.map((t) => (
                      <motion.div
                        key={t.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3 flex items-center gap-3 transition-colors hover:border-brand-500/30"
                      >
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface-primary flex items-center justify-center font-bold text-brand-400 text-xs sm:text-sm border border-white/5 shadow-inner shrink-0">
                          {t.token_number}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-white truncate">{t.guest_name || t.profiles?.full_name || 'Appointment'}</p>
                          <p className="text-[11px] text-brand-300">
                            {t.scheduled_for ? new Date(t.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} · {t.services?.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button 
                            variant="secondary"
                            onClick={() => updateStatus(t.id, 'call', t)}
                            loading={actionLoading === t.id}
                            disabled={actionLoading !== null}
                            className="px-2.5 py-1 text-xs h-auto"
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

        {/* Completed Today: order 3 on mobile */}
        <div className="lg:col-span-2 order-3 lg:order-none">
          <Card className="p-4 sm:p-5">
            <h2 className="text-xs sm:text-sm font-bold text-dark-100 uppercase tracking-wider mb-3 sm:mb-4">Completed Today</h2>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[480px]">
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
            {/* Mobile Cards */}
            <div className="sm:hidden space-y-2">
              {tokens.filter(t => ['completed', 'skipped', 'cancelled'].includes(t.status)).reverse().slice(0, 5).map(t => (
                <div key={t.id} className="bg-surface-tertiary border border-white/[0.06] rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-bold text-white text-sm">#{t.token_number}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{t.guest_name || t.profiles?.full_name || '—'}</p>
                      <p className="text-[11px] text-dark-200 truncate">{t.services?.name ?? '—'} {t.workers?.name ? `· ${t.workers.name}` : ''}</p>
                    </div>
                  </div>
                  <TokenBadge status={t.status} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Add Walk-in Modal */}
      <Modal 
        open={walkInModalOpen} 
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
        open={reassignModalOpen} 
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
