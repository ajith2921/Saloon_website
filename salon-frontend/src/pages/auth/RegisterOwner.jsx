import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Store, User, Mail, Phone, Lock, Building2, MapPin, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Button, Input, Card } from '../../components/ui'
import api from '../../lib/api'

export default function RegisterOwner() {
  const { signUp, refreshProfile } = useAuth()
  const { success, error: showError } = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1: Personal Info, 2: Salon Info
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const [form, setForm] = useState({
    // Personal Info
    fullName: '',
    email: '',
    phone: '',
    password: '',
    // Salon Info
    salonName: '',
    city: '',
    address: '',
  })

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const validateStep1 = () => {
    const e = {}
    if (!form.fullName.trim())       e.fullName = 'Name is required'
    if (!form.email)                 e.email    = 'Email is required'
    if (!form.phone)                 e.phone    = 'Phone is required'
    if (form.password.length < 8)    e.password = 'Password must be at least 8 characters'
    setErrors(e)
    return !Object.keys(e).length
  }

  const validateStep2 = () => {
    const e = {}
    if (!form.salonName.trim()) e.salonName = 'Salon name is required'
    if (!form.city.trim())      e.city = 'City is required'
    if (!form.address.trim())   e.address = 'Full address is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2)
      setErrors({})
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep2()) return
    
    setLoading(true)
    try {
      // Step 1: Create Supabase Auth Account
      await signUp({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
      })

      // We wait a second to allow the database trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Step 2: Register Salon via API
      await api.post('/api/salons', {
        name: form.salonName,
        city: form.city,
        address: form.address,
        phone: form.phone, // fallback to owner phone
        max_daily_tokens: 100,
        avg_service_minutes: 30
      })

      await refreshProfile()
      
      success('Welcome aboard!', 'Your salon has been registered.')
      navigate('/admin', { replace: true })
    } catch (err) {
      // If error mentions auth, it might be that account exists
      if (err.message && err.message.toLowerCase().includes('already registered')) {
        showError('Email is already registered. Please login and click "Partner with us".')
        navigate('/login')
      } else {
        showError(err.response?.data?.detail || err.message || 'Registration failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-primary py-12 px-4 bg-grid flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-radial from-brand-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-xl w-full relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-brand shadow-glow-gold mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Partner with QueueCut</h1>
          <p className="text-dark-100">Grow your business and eliminate waiting rooms.</p>
        </div>

        <Card>
          {/* Progress Bar */}
          <div className="mb-8 relative">
            <div className="flex justify-between mb-2">
              <span className={`text-sm font-medium ${step >= 1 ? 'text-brand-400' : 'text-dark-200'}`}>1. Personal Info</span>
              <span className={`text-sm font-medium ${step >= 2 ? 'text-brand-400' : 'text-dark-200'}`}>2. Shop Details</span>
            </div>
            <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand-500 transition-all duration-300 ease-out"
                style={{ width: step === 1 ? '50%' : '100%' }}
              />
            </div>
          </div>

          <form onSubmit={step === 2 ? handleSubmit : (e) => e.preventDefault()} noValidate>
            {step === 1 ? (
              <div className="space-y-4 animate-fade-in">
                <Input
                  label="Full Name"
                  id="fullName"
                  icon={User}
                  value={form.fullName}
                  onChange={set('fullName')}
                  error={errors.fullName}
                  placeholder="Your full name"
                />
                <Input
                  label="Email Address"
                  id="email"
                  type="email"
                  icon={Mail}
                  value={form.email}
                  onChange={set('email')}
                  error={errors.email}
                  placeholder="owner@example.com"
                />
                <Input
                  label="Phone Number"
                  id="phone"
                  type="tel"
                  icon={Phone}
                  value={form.phone}
                  onChange={set('phone')}
                  error={errors.phone}
                  placeholder="+91 98765 43210"
                />
                <Input
                  label="Password"
                  id="password"
                  type="password"
                  icon={Lock}
                  value={form.password}
                  onChange={set('password')}
                  error={errors.password}
                  placeholder="At least 8 characters"
                />
                <Button 
                  type="button"
                  fullWidth 
                  className="mt-4" 
                  onClick={handleNext}
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <Input
                  label="Shop Name"
                  id="salonName"
                  icon={Building2}
                  value={form.salonName}
                  onChange={set('salonName')}
                  error={errors.salonName}
                  placeholder="e.g. The Vintage Barbershop"
                />
                <Input
                  label="City"
                  id="city"
                  icon={MapPin}
                  value={form.city}
                  onChange={set('city')}
                  error={errors.city}
                  placeholder="e.g. Mumbai"
                />
                <Input
                  label="Full Address"
                  id="address"
                  value={form.address}
                  onChange={set('address')}
                  error={errors.address}
                  placeholder="e.g. 123 Main Street, Suite 4"
                />

                <div className="flex gap-4 mt-6">
                  <Button 
                    type="button"
                    variant="ghost" 
                    className="flex-1" 
                    onClick={() => setStep(1)}
                    disabled={loading}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button 
                    type="submit"
                    className="flex-1"
                    loading={loading}
                  >
                    Launch Shop <CheckCircle className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </form>

          <div className="text-center mt-8 pt-6 border-t border-white/5">
            <p className="text-sm text-dark-100">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
