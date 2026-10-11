import { useState, useEffect } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { Scissors, Clock, ArrowRight, ChevronLeft, AlertCircle, CheckCircle, Check } from 'lucide-react'
import { useSalon, useSalonServices, useSalonWorkers } from '../../hooks/useApi'
import { useRealtimeQueue } from '../../hooks/useRealtime'
import { useToast } from '../../context/ToastContext'
import { Card, Button } from '../../components/ui'
import api from '../../lib/api'

export default function GetToken() {
  const { salonId } = useParams()
  const [searchParams] = useSearchParams()
  const { success, error: showError, info } = useToast()

  const { data: salon }          = useSalon(salonId)
  const { data: servicesData }   = useSalonServices(salonId)
  const { data: workersData }    = useSalonWorkers(salonId)
  const { waitingTokens } = useRealtimeQueue(salonId)

  const [selectedServices, setSelectedServices] = useState([])
  const [selectedWorker,  setSelectedWorker]  = useState(null)
  const [loading, setLoading]                 = useState(false)
  const [token, setToken]                     = useState(null)
  const [isBooking, setIsBooking]             = useState(searchParams.get('mode') === 'book')
  const [scheduledFor, setScheduledFor]       = useState('')

  const services = (servicesData?.services ?? []).filter((s) => s.status === 'active')
  const workers  = (workersData?.workers   ?? []).filter((w) => w.status === 'active')

  // Auto-select first service if none selected
  useEffect(() => {
    if (services.length > 0 && selectedServices.length === 0) {
      setSelectedServices([services[0]])
    }
  }, [services, selectedServices.length])

  const toggleService = (service) => {
    setSelectedServices(prev => {
      const isSelected = prev.some(s => s.id === service.id)
      if (isSelected) {
        if (prev.length <= 1) {
          info('At least one service must be selected')
          return prev
        }
        return prev.filter(s => s.id !== service.id)
      } else {
        return [...prev, service]
      }
    })
  }

  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
  const totalPrice = selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0)
  const servicesSummary = selectedServices.map(s => s.name).join(', ')

  const waitMins = waitingTokens.length * (totalDuration || 30)
  const estimatedMin = Math.max(0, waitMins - 5)
  const estimatedMax = waitMins + 10

  const handleGetToken = async () => {
    if (selectedServices.length === 0) { info('Please select at least one service'); return }
    if (isBooking && !scheduledFor) { info('Please select a date and time for your appointment'); return }

    setLoading(true)
    try {
      const payload = {
        salon_id:   salonId,
        service_id: selectedServices[0].id,
        service_ids: selectedServices.map(s => s.id),
        worker_id:  selectedWorker?.id ?? null,
        is_booking: isBooking,
      }
      
      if (isBooking) {
        // Convert local datetime string to UTC ISO string
        payload.scheduled_for = new Date(scheduledFor).toISOString()
      }

      const res = await api.post('/api/tokens', payload)
      setToken(res.data)
      success(isBooking ? `Booking Confirmed!` : `Token #${res.data.token_number} issued!`, 'You are now in the queue.')
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

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-surface-tertiary/50 border border-white/5 rounded-2xl p-4">
              <p className="text-[10px] font-semibold text-dark-200 uppercase tracking-widest mb-1">Status</p>
              <p className="font-display font-bold text-2xl text-white capitalize">{token.status}</p>
            </div>
            <div className="bg-brand-500/5 border border-brand-500/10 rounded-2xl p-4">
              <p className="text-[10px] font-semibold text-dark-200 uppercase tracking-widest mb-1">
                {token.is_booking ? 'Scheduled For' : 'Est. Wait'}
              </p>
              {token.is_booking ? (
                <div className="text-left">
                  <p className="font-display font-bold text-lg text-brand-400">
                    {new Date(token.scheduled_for).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-brand-400">
                    {new Date(token.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ) : (
                <p className="font-display font-bold text-2xl text-brand-400">
                  {waitMins === 0 ? 'Next!' : `${estimatedMin}–${estimatedMax}m`}
                </p>
              )}
            </div>
          </div>

          {/* Booked Services Summary */}
          <div className="bg-surface-tertiary/50 border border-white/5 rounded-2xl p-4 mb-6 text-left">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-dark-200 uppercase tracking-widest mb-1">
                  {selectedServices.length > 1 ? `${selectedServices.length} Services Booked` : 'Service Booked'}
                </p>
                <p className="font-semibold text-white text-sm">
                  {token.services_summary || servicesSummary}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-brand-400 font-bold text-base">₹{token.total_price ?? totalPrice}</p>
                <p className="text-xs text-dark-200">{token.total_duration ?? totalDuration} min</p>
              </div>
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
        <ChevronLeft className="w-4 h-4" /> Back to {salon?.name ?? 'Salon'}
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
          <Scissors className="w-6 h-6 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Get Your Token</h1>
          <p className="text-dark-100 text-sm">Join the queue at {salon?.name}</p>
        </div>
      </div>

      <div className="bg-surface-secondary border border-white/5 rounded-2xl p-6">
        
        {/* Toggle between Live Queue and Booking */}
        <div className="flex bg-surface-tertiary p-1 rounded-lg mb-6">
          <button
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${!isBooking ? 'bg-surface-primary text-white shadow' : 'text-dark-200 hover:text-white'}`}
            onClick={() => setIsBooking(false)}
          >
            Live Queue
          </button>
          <button
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${isBooking ? 'bg-surface-primary text-white shadow' : 'text-dark-200 hover:text-white'}`}
            onClick={() => setIsBooking(true)}
          >
            Book Appointment
          </button>
        </div>

        {/* 1. Services */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="block text-sm font-semibold text-white">
                1. Select Services <span className="text-brand-400 text-xs font-normal">(Choose one or more)</span>
              </label>
              <p className="text-xs text-dark-200 mt-0.5">Tap to select or deselect multiple services</p>
            </div>
            {selectedServices.length > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-semibold">
                {selectedServices.length} selected
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {services.map(s => {
              const isSelected = selectedServices.some(sel => sel.id === s.id)
              return (
                <div 
                  key={s.id}
                  onClick={() => toggleService(s)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden select-none ${
                    isSelected 
                      ? 'border-brand-500 bg-brand-500/10 shadow-glow-sm ring-1 ring-brand-500/30' 
                      : 'border-white/5 bg-surface-tertiary hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        isSelected ? 'bg-brand-500 border-brand-500 text-white' : 'border-white/20 bg-surface-primary'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${isSelected ? 'text-brand-400 font-bold' : 'text-white'}`}>
                          {s.name}
                        </p>
                        <p className="text-xs text-dark-200 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-brand-400" /> {s.duration_minutes} min
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-white shrink-0">₹{s.price}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Multiple Services Live Summary Bar */}
          {selectedServices.length > 0 && (
            <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-brand-500/10 via-surface-tertiary to-brand-500/5 border border-brand-500/20 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Scissors className="w-4 h-4 text-brand-400 shrink-0" />
                <p className="text-xs text-white truncate max-w-[260px] sm:max-w-sm">
                  <span className="font-semibold text-brand-300">Selected:</span> {servicesSummary}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-white ml-auto">
                <span className="flex items-center gap-1 text-dark-100">
                  <Clock className="w-3.5 h-3.5 text-brand-400" />
                  {totalDuration} mins total
                </span>
                <span className="text-brand-400 text-sm font-bold">
                  ₹{totalPrice}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2. Worker (Optional) */}
        {workers.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-white mb-1">2. Select Barber <span className="text-dark-300 font-normal">(Optional)</span></label>
            <p className="text-xs text-dark-200 mb-3">Choose a specific barber, or leave unselected for the fastest service.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div
                onClick={() => setSelectedWorker(null)}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedWorker === null
                    ? 'border-brand-500 bg-brand-500/10' 
                    : 'border-white/5 bg-surface-tertiary hover:border-white/10'
                }`}
              >
                <div className="w-10 h-10 mx-auto rounded-full bg-surface-primary border border-white/5 flex items-center justify-center mb-2">
                  <span className="text-xs font-semibold text-dark-100">Any</span>
                </div>
                <p className={`text-xs font-semibold ${selectedWorker === null ? 'text-brand-400' : 'text-white'}`}>
                  First Available
                </p>
              </div>

              {workers.map(w => (
                <div
                  key={w.id}
                  onClick={() => setSelectedWorker(w)}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    selectedWorker?.id === w.id
                      ? 'border-brand-500 bg-brand-500/10' 
                      : 'border-white/5 bg-surface-tertiary hover:border-white/10'
                  }`}
                >
                  <div className="w-10 h-10 mx-auto rounded-full bg-surface-primary border border-white/5 overflow-hidden mb-2">
                    {w.photo_url ? (
                      <img src={w.photo_url} alt={w.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-brand-500/20 text-brand-400 text-xs font-bold">
                        {w.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className={`text-xs font-semibold truncate ${selectedWorker?.id === w.id ? 'text-brand-400' : 'text-white'}`}>
                    {w.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Schedule Time (If Booking) */}
        {isBooking && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-white mb-2">3. Schedule Time</label>
            <input 
              type="datetime-local" 
              className="w-full bg-surface-tertiary border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
        )}

        {/* Queue Info (If Live) */}
        {!isBooking && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm text-white font-semibold mb-1">Queue Status</p>
              <p className="text-xs text-amber-200/70">
                {waitingTokens.length} people ahead of you. Estimated wait: {waitMins === 0 ? 'None' : `${estimatedMin}–${estimatedMax} mins`}.
              </p>
            </div>
          </div>
        )}

        {/* Action */}
        <Button 
          fullWidth 
          onClick={handleGetToken} 
          loading={loading}
          disabled={selectedServices.length === 0 || (isBooking && !scheduledFor)}
          className="h-14 text-lg"
        >
          {isBooking 
            ? `Book Appointment (₹${totalPrice})` 
            : `Join Live Queue (₹${totalPrice})`
          } <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>

      <p className="text-xs text-dark-200 text-center mt-3">
        <AlertCircle className="w-3 h-3 inline mr-1" />
        You can cancel your token anytime before being called.
      </p>
    </div>
  )
}

