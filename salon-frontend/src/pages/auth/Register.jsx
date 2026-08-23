import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Scissors, Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Button, Input, Card } from '../../components/ui'

const PERKS = [
  'Get a digital token — no physical waiting',
  'Track live queue position from anywhere',
  'Receive alerts when your turn is near',
  'Rate your barber & earn loyalty points',
]

export default function Register() {
  const { signUp } = useAuth()
  const { success, error: showError } = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const validate = () => {
    const e = {}
    if (!form.fullName.trim())       e.fullName = 'Name is required'
    if (!form.email)                 e.email    = 'Email is required'
    if (!form.phone)                 e.phone    = 'Phone is required'
    if (form.password.length < 8)    e.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirmPassword)
                                     e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await signUp({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
      })
      success('Account created!', 'Welcome to QueueCut. Please check your email to verify.')
      navigate('/login')
    } catch (err) {
      showError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-primary py-12 px-4 bg-grid">
      <div className="absolute inset-0 bg-gradient-radial from-brand-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 grid md:grid-cols-2 gap-8 items-center animate-fade-in">
        {/* Left panel */}
        <div className="hidden md:flex flex-col gap-8">
          <div>
            <Link to="/" className="flex items-center gap-2.5 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm">
                <Scissors className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-white text-lg">QueueCut</span>
            </Link>
            <h2 className="text-3xl font-bold text-white leading-tight">
              Skip the wait.<br />
              <span className="text-gradient-brand">Get your cut smarter.</span>
            </h2>
            <p className="text-dark-100 mt-3 leading-relaxed">
              Join thousands of customers who never wait in line again.
              Get digital tokens, track live queues, and visit the salon at the right time.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {PERKS.map((perk) => (
              <div key={perk} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-sm text-dark-100">{perk}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <Card>
          <div className="mb-6 text-center md:text-left">
            <h1 className="text-xl font-bold text-white">Create your account</h1>
            <p className="text-dark-100 text-sm mt-0.5">It's free — no credit card required</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <Input
              id="fullName"
              type="text"
              label="Full name"
              icon={User}
              autoComplete="name"
              placeholder="Your full name"
              value={form.fullName}
              onChange={set('fullName')}
              error={errors.fullName}
            />

            <Input
              id="reg-email"
              type="email"
              label="Email address"
              icon={Mail}
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              error={errors.email}
            />

            <Input
              id="phone"
              type="tel"
              label="Phone number"
              icon={Phone}
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={set('phone')}
              error={errors.phone}
            />

            <div className="relative">
              <Input
                id="reg-password"
                type={showPass ? 'text' : 'password'}
                label="Password"
                icon={Lock}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={set('password')}
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

            <Input
              id="confirmPassword"
              type="password"
              label="Confirm password"
              icon={Lock}
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              error={errors.confirmPassword}
            />

            <p className="text-xs text-dark-200">
              By registering you agree to our Terms of Service and Privacy Policy.
            </p>

            <Button
              type="submit"
              id="btn-register"
              loading={loading}
              fullWidth
              className="mt-2"
            >
              Create Account <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <p className="text-sm text-dark-100 text-center mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
