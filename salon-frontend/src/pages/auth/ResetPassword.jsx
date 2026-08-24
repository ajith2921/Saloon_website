import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { Button, Input, Card } from '../../components/ui'
import { supabase } from '../../lib/supabase'

export default function ResetPassword() {
  const { success, error: showError } = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    try {
      setLoading(true)
      const { error } = await supabase.auth.updateUser({ password: form.password })
      if (error) throw error

      success('Password Updated', 'Your password has been successfully reset.')
      navigate('/login')
    } catch (err) {
      showError(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-white tracking-tight">Reset Password</h2>
          <p className="text-dark-200">Enter your new password below.</p>
        </div>

        <Card className="p-6 bg-dark-800/50 backdrop-blur-xl border-dark-700">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                label="New Password"
                type={showPass ? "text" : "password"}
                icon={Lock}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                error={errors.password}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-[38px] text-dark-200 hover:text-white transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Input
              label="Confirm Password"
              type={showPass ? "text" : "password"}
              icon={Lock}
              value={form.confirmPassword}
              onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
              error={errors.confirmPassword}
              placeholder="••••••••"
              required
            />

            <Button type="submit" loading={loading} fullWidth className="mt-4">
              Update Password <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
