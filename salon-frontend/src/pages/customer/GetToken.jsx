import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Scissors, Clock, ArrowRight, ChevronLeft, AlertCircle, CheckCircle } from 'lucide-react'
import { useSalon, useSalonServices, useSalonWorkers } from '../../hooks/useApi'
import { useRealtimeQueue } from '../../hooks/useRealtime'
import { useToast } from '../../context/ToastContext'
import { EmptyState, Card, Button } from '../../components/ui'
import api from '../../lib/api'

export default function GetToken() {
  const { salonId } = useParams()
  const { success, error: showError, info } = useToast()

  const { data: salon }          = useSalon(salonId)
  const { data: servicesData }   = useSalonServices(salonId)
  const { data: workersData }    = useSalonWorkers(salonId)
  const { waitingTokens, currentToken } = useRealtimeQueue(salonId)

  const [selectedService, setSelectedService] = useState(null)
  const [selectedWorker,  setSelectedWorker]  = useState(null)
  const [loading, setLoading]                 = useState(false)
  const [token, setToken]                     = useState(null)

  const services = (servicesData?.services ?? []).filter((s) => s.status === 'active')
  const workers  = (workersData?.workers   ?? []).filter((w) => w.status === 'active')

  // Auto-select first service
  useEffect(() => {
    if (services.length > 0 && !selectedService) setSelectedService(services[0])
  }, [services, selectedService])

  const waitMins = waitingTokens.length * (selectedService?.duration_minutes ?? 30)
  const estimatedMin = Math.max(0, waitMins - 5)
  const estimatedMax = waitMins + 10

  const handleGetToken = async () => {
    if (!selectedService) { info('Please select a service'); return }

    setLoading(true)
    try {
      const res = await api.post('/api/tokens', {
        salon_id:   salonId,
        service_id: selectedService.id,
        worker_id:  selectedWorker?.id ?? null,
      })
      setToken(res.data)
      success(`Token #${res.data.token_number} issued!`, 'You are now in the queue.')
    } catch (err) {
      showError(err.message || 'Could not get token. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Success state — show token
  if (token) {
    return (
      <div className="container-app max-w-md mx-auto py-12">
        <Card className="p-8 text-center animate-token">
          <div className="w-16 h-16 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-brand-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Token Confirmed!</h2>
          <p className="text-dark-100 text-sm mb-6">You are now in the queue at {salon?.name}</p>

          {/* Big token number */}
          <div className="bg-gradient-card border-2 border-brand-500/20 rounded-3xl p-8 mb-6 relative overflow-hidden shadow-glow-sm">
            <div className="absolute inset-0 bg-gradient-radial from-brand-500/10 to-transparent pointer-events-none" />
            <p className="text-xs font-semibold uppercase tracking-widest text-dark-200 mb-2">Your Token</p>
            <p className="token-number font-display text-[6rem] font-black text-white leading-none relative z-10 drop-shadow-lg">#{token.token_number}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-surface-tertiary/50 border border-white/5 rounded-2xl p-4">
              <p className="text-[10px] font-semibold text-dark-200 uppercase tracking-widest mb-1">Now Serving</p>
              <p className="font-display font-bold text-2xl text-white">{currentToken ? `#${currentToken.token_number}` : '—'}</p>
            </div>
            <div className="bg-brand-500/5 border border-brand-500/10 rounded-2xl p-4">
              <p className="text-[10px] font-semibold text-dark-200 uppercase tracking-widest mb-1">Est. Wait</p>
              <p className="font-display font-bold text-2xl text-brand-400">
                {waitMins === 0 ? 'Next!' : `${estimatedMin}–${estimatedMax}m`}
              </p>
            </div>
          </div>

          <Link to="/my-token" className="block w-full">
            <Button fullWidth>Track My Queue <ArrowRight className="w-4 h-4 ml-1" /></Button>
          </Link>
          <Button variant="ghost" fullWidth onClick={() => setToken(null)} className="mt-2">
            Get another token
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="container-app max-w-2xl mx-auto py-8">
      {/* Back */}
      <Link to={`/salons/${salonId}`} className="flex items-center gap-1.5 text-dark-100 hover:text-white text-sm mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> {salon?.name ?? 'Back to Salon'}
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white leading-tight">Get Your Token</h1>
        <p className="text-dark-100 text-sm mt-1">
          Choose a service to join the queue at {salon?.name}
        </p>
      </div>

      {/* Queue status bar */}
      <Card className="card-elevated p-4 flex items-center justify-between mb-6 border border-brand-500/10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <div>
            <p className="text-sm font-semibold text-white">
              {waitingTokens.length} waiting · {currentToken ? `Serving #${currentToken.token_number}` : 'No one being served'}
            </p>
            <p className="text-xs text-dark-200">
              {salon?.max_daily_tokens
                ? `Daily limit: ${salon.max_daily_tokens} tokens`
                : 'Unlimited daily tokens'}
            </p>
          </div>
        </div>
        <p className="text-brand-400 font-bold text-sm">
          ~{waitMins === 0 ? '0' : `${estimatedMin}-${estimatedMax}`}m wait
        </p>
      </Card>

      {/* Service selection */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-display font-bold text-white mb-4">
          Select Service <span className="text-brand-500">*</span>
        </h2>
        {services.length === 0 ? (
          <EmptyState icon={Scissors} title="No services available" description="This salon hasn't added services yet." />
        ) : (
          <div className="grid gap-2">
            {services.map((svc) => (
              <button
                key={svc.id}
                onClick={() => setSelectedService(svc)}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  selectedService?.id === svc.id
                    ? 'border-brand-500/40 bg-brand-500/10 text-white'
                    : 'border-white/[0.06] bg-surface-tertiary text-dark-100 hover:border-white/20 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedService?.id === svc.id ? 'border-brand-500 bg-brand-500' : 'border-dark-300'
                  }`}>
                    {selectedService?.id === svc.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{svc.name}</p>
                    <p className="text-xs text-dark-200 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {svc.duration_minutes} min
                    </p>
                  </div>
                </div>
                <span className="font-bold text-brand-400">₹{svc.price}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Worker preference */}
      {workers.length > 0 && (
        <Card className="p-5 mb-6">
          <h2 className="text-base font-bold text-white mb-1">
            Preferred Barber <span className="text-dark-200 text-sm font-normal">(optional)</span>
          </h2>
          <p className="text-xs text-dark-200 mb-3">Leave blank to be assigned to the next available barber.</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedWorker(null)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                !selectedWorker
                  ? 'border-brand-500/40 bg-brand-500/10 text-brand-400'
                  : 'border-white/[0.06] bg-surface-tertiary text-dark-100 hover:text-white'
              }`}
            >
              Any barber
            </button>
            {workers.map((worker) => (
              <button
                key={worker.id}
                onClick={() => setSelectedWorker(worker)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                  selectedWorker?.id === worker.id
                    ? 'border-brand-500/40 bg-brand-500/10 text-white'
                    : 'border-white/[0.06] bg-surface-tertiary text-dark-100 hover:text-white'
                }`}
              >
                <div className="w-6 h-6 rounded-lg bg-surface-elevated flex items-center justify-center text-xs font-bold">
                  {worker.name[0]}
                </div>
                {worker.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Summary */}
      {selectedService && (
        <div className="animate-slide-up">
          <Card className="card-elevated p-6 mb-6 border-2 border-brand-500/20 bg-gradient-card">
            <p className="text-sm font-semibold uppercase tracking-widest text-dark-100 mb-4">Summary</p>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-sm items-center">
                <span className="text-dark-100">Service</span>
                <span className="text-white font-medium">{selectedService.name}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-dark-100">Duration</span>
                <span className="text-white">{selectedService.duration_minutes} min</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-dark-100">Price</span>
                <span className="text-brand-400 font-bold text-lg">₹{selectedService.price}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-dark-100">Barber</span>
                <span className="text-white">{selectedWorker?.name ?? 'Any available'}</span>
              </div>
              <div className="flex justify-between text-sm items-center pt-2 border-t border-white/5 mt-1">
                <span className="text-dark-100">Est. Wait</span>
                <span className="text-brand-400 font-bold">
                  {waitMins === 0 ? 'No wait!' : `${estimatedMin}–${estimatedMax} min`}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Action */}
      <Button
        id="btn-get-token"
        onClick={handleGetToken}
        loading={loading}
        disabled={!selectedService}
        fullWidth
        className="py-4 text-base"
      >
        Get My Token <ArrowRight className="w-5 h-5 ml-1" />
      </Button>

      <p className="text-xs text-dark-200 text-center mt-3">
        <AlertCircle className="w-3 h-3 inline mr-1" />
        You can cancel your token anytime before being called.
      </p>
    </div>
  )
}

