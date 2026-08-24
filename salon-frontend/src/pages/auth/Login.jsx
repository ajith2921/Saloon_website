import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Scissors, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Button, Input, Card } from '../../components/ui'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const { success, error: showError } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname ?? '/'

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.email)    e.email    = 'Email is required'
    if (!form.password) e.password = 'Password is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await signIn(form)
      success('Welcome back!', 'Signed in successfully')
      navigate(from, { replace: true })
    } catch (err) {
      showError(err.message || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-primary flex items-center justify-center px-4 bg-grid relative overflow-hidden">
      {/* Background gradient — larger and more visible */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(234,179,8,0.12),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_80%,rgba(234,179,8,0.05),transparent)] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-brand shadow-glow-gold mb-4">
            <Scissors className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-dark-100 text-sm mt-1">Sign in to your QueueCut account</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {/* Email */}
            <Input
              id="email"
              type="email"
              label="Email address"
              icon={Mail}
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={errors.email}
            />

            {/* Password */}
            <div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  label="Password"
                  icon={Lock}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  error={errors.password}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-[38px] text-dark-200 hover:text-white transition-colors"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-end gap-2 mt-2 mb-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (!form.email) { showError('Enter your email first'); return }
                    try {
                      await supabase.auth.resetPasswordForEmail(form.email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      })
                      success('Reset link sent!', 'Check your email for the password reset link')
                    } catch { showError('Could not send reset email') }
                  }}
                  className="shrink-0 whitespace-nowrap text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <Button
              type="submit"
              id="btn-login"
              loading={loading}
              fullWidth
              className="mt-2"
            >
              Sign In <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-sm text-dark-100">
              Don't have an account?{' '}
              <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                Create account
              </Link>
            </p>
          </div>
        </Card>

        {/* Demo credentials — clickable to autofill */}
        <div className="mt-4 card p-4">
          <p className="text-xs text-dark-200 text-center font-medium mb-3">Demo accounts — click to fill</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setForm({ email: 'customer@demo.com', password: 'demo1234' })}
              className="text-left p-3 rounded-xl bg-surface-tertiary hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              <p className="text-white font-semibold mb-1">Customer</p>
              <p className="text-dark-200">customer@demo.com</p>
              <p className="text-dark-300">demo1234</p>
            </button>
            <button
              type="button"
              onClick={() => setForm({ email: 'admin@demo.com', password: 'demo1234' })}
              className="text-left p-3 rounded-xl bg-surface-tertiary hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              <p className="text-white font-semibold mb-1">Salon Admin</p>
              <p className="text-dark-200">admin@demo.com</p>
              <p className="text-dark-300">demo1234</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
