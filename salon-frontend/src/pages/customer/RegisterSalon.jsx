import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, MapPin, Building2, Phone } from 'lucide-react'
import { Card, Input, Button } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'

export default function RegisterSalon() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const { success, error: showError } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    phone: '',
    max_daily_tokens: 100,
    avg_service_minutes: 30,
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Create the salon via API. The backend will upgrade our role to salon_owner
      const payload = {
        ...formData,
        max_daily_tokens: parseInt(formData.max_daily_tokens, 10),
        avg_service_minutes: parseInt(formData.avg_service_minutes, 10),
      }
      
      await api.post('/api/salons', payload)
      
      // Refresh the local session profile so the frontend gets the new role
      await refreshProfile()
      
      success("Shop registered successfully! Welcome aboard.")
      
      // The guard routes will automatically redirect to /admin since we are now an owner,
      // but we explicitly navigate there to trigger the render.
      navigate('/admin')
      
    } catch (err) {
      showError(err.response?.data?.detail || err.message || "Failed to register shop")
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
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

      <Card className="p-6 sm:p-8">
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

          <div className="pt-4 flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(-1)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              loading={loading}
            >
              Register Shop
            </Button>
          </div>
        </form>
      </Card>
      
      <p className="text-center text-xs text-dark-300 mt-6">
        By registering, you agree to our Platform Terms of Service and Privacy Policy.
        Your shop will be subject to approval by platform administrators.
      </p>
    </div>
  )
}
