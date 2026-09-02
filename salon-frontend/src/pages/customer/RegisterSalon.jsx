import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, MapPin, Building2, Phone, Check, ArrowRight } from 'lucide-react'
import { Card, Input, Button, Skeleton } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useSubscriptionPlans } from '../../hooks/useApi'
import api from '../../lib/api'

// Helper to load Razorpay Script
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function RegisterSalon() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const { success, error: showError } = useToast()
  
  const [step, setStep] = useState(1) // 1: Plans, 2: Details
  const [loading, setLoading] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState(null)
  
  const { data: plans, loading: loadingPlans } = useSubscriptionPlans()

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    phone: '',
    max_daily_tokens: 100,
    avg_service_minutes: 30,
  })

  // Set default free plan if available and none selected
  useEffect(() => {
    if (plans?.length && !selectedPlanId) {
      const free = plans.find(p => parseFloat(p.price) === 0)
      if (free) setSelectedPlanId(free.id)
      else setSelectedPlanId(plans[0].id)
    }
  }, [plans, selectedPlanId])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleNextStep = () => {
    if (!selectedPlanId) {
      showError("Please select a subscription plan")
      return
    }
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // 1. Create the salon via API.
      const payload = {
        ...formData,
        max_daily_tokens: parseInt(formData.max_daily_tokens, 10),
        avg_service_minutes: parseInt(formData.avg_service_minutes, 10),
      }
      
      const salonRes = await api.post('/api/salons', payload)
      const newSalonId = salonRes.data?.id
      
      // Refresh local session so frontend gets new role (salon_owner)
      await refreshProfile()

      const selectedPlan = plans.find(p => p.id === selectedPlanId)
      
      // 2. If it's a paid plan, initiate checkout
      if (selectedPlan && parseFloat(selectedPlan.price) > 0) {
        success("Shop created! Proceeding to payment...")
        const checkoutRes = await api.post('/api/billing/checkout', { plan_id: selectedPlan.id })
        
        const sdkLoaded = await loadRazorpayScript()
        if (!sdkLoaded) {
          throw new Error("Razorpay SDK failed to load. Are you offline?")
        }
        
        const { provider_order_id, razorpay_key_id, currency } = checkoutRes.data

        const options = {
          key: razorpay_key_id,
          subscription_id: provider_order_id,
          name: 'QueueCut',
          description: `Subscription for ${formData.name}`,
          currency: currency,
          handler: function (response) {
            success("Payment successful! Welcome to QueueCut.")
            navigate('/admin')
          },
          modal: {
            ondismiss: function() {
              // If they dismiss, they are still a salon_owner but with a trialing/incomplete sub
              navigate('/admin/subscription')
            }
          }
        }
        
        const rzp = new window.Razorpay(options)
        rzp.open()

      } else {
        // Free plan
        success("Shop registered successfully! Welcome aboard.")
        navigate('/admin')
      }
      
    } catch (err) {
      showError(err.response?.data?.detail || err.message || "Failed to register shop")
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-0">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center mx-auto mb-4 border border-brand-500/30">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-display font-bold text-white tracking-tight mb-2">
          Partner with QueueCut
        </h1>
        <p className="text-dark-200">
          Bring your salon into the digital age. Manage your queue, staff, and services effortlessly.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center mb-10 max-w-md mx-auto">
        <div className={`flex flex-col items-center ${step >= 1 ? 'text-brand-400' : 'text-dark-300'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mb-2 ${step >= 1 ? 'border-brand-400 bg-brand-500/20' : 'border-dark-300 bg-surface-primary'}`}>
            1
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider">Plan</span>
        </div>
        <div className={`flex-1 h-0.5 mx-4 ${step >= 2 ? 'bg-brand-400' : 'bg-dark-300'}`} />
        <div className={`flex flex-col items-center ${step >= 2 ? 'text-brand-400' : 'text-dark-300'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mb-2 ${step >= 2 ? 'border-brand-400 bg-brand-500/20' : 'border-dark-300 bg-surface-primary'}`}>
            2
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider">Details</span>
        </div>
      </div>

      {step === 1 && (
        <div className="animate-slide-up">
          <h2 className="text-2xl font-semibold text-center text-white mb-8">Choose a Subscription Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loadingPlans ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-96 w-full rounded-2xl" />)
            ) : (
              plans?.map(plan => {
                const isSelected = selectedPlanId === plan.id
                const isFree = parseFloat(plan.price) === 0
                return (
                  <Card 
                    key={plan.id}
                    className={`relative cursor-pointer transition-all duration-300 ${isSelected ? 'ring-2 ring-brand-400 bg-brand-500/5 translate-y-[-4px]' : 'hover:border-white/20'}`}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    {isSelected && (
                      <div className="absolute top-4 right-4 text-brand-400">
                        <Check className="w-6 h-6" />
                      </div>
                    )}
                    <div className="p-6 text-center border-b border-white/5">
                      <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-3xl font-display font-black text-white">
                          {isFree ? 'Free' : `₹${parseFloat(plan.price)}`}
                        </span>
                        {!isFree && <span className="text-sm text-dark-200">/{plan.billing_interval === 'yearly' ? 'yr' : 'mo'}</span>}
                      </div>
                    </div>
                    <div className="p-6">
                      <ul className="space-y-4">
                        {plan.features?.map((feature, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-dark-100">
                            <Check className="w-5 h-5 text-brand-400 shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
          <div className="mt-10 flex justify-center">
            <Button
              size="lg"
              variant="primary"
              onClick={handleNextStep}
              disabled={loadingPlans || !selectedPlanId}
              className="min-w-[200px]"
            >
              Continue to Details <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <Card className="p-6 sm:p-8 max-w-2xl mx-auto animate-slide-up">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
                Shop Details
              </h2>
              
              <Input
                label="Shop Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. The Vintage Barbershop"
                icon={Building2}
                required
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="City"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="e.g. Mumbai"
                  icon={MapPin}
                  required
                />
                <Input
                  label="Phone Number"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. +91 9876543210"
                  icon={Phone}
                  required
                />
              </div>
              
              <Input
                label="Full Address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="e.g. 123 Main Street, Suite 4"
                required
              />
            </div>

            <div className="pt-4 flex flex-col-reverse sm:flex-row items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                className="w-full sm:flex-1"
                disabled={loading}
              >
                Back to Plans
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="w-full sm:flex-1"
                loading={loading}
              >
                Register & Subscribe
              </Button>
            </div>
          </form>
        </Card>
      )}
      
      <p className="text-center text-xs text-dark-300 mt-8">
        By registering, you agree to our Platform Terms of Service and Privacy Policy.
        Your shop will be subject to approval by platform administrators.
      </p>
    </div>
  )
}
