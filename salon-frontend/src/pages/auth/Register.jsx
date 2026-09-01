import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Scissors, Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, CheckCircle, Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const { signUp, signInWithGoogle } = useAuth()
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
  const [showEmailForm, setShowEmailForm] = useState(false)
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
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-display font-bold text-white mb-2">{t('auth.create_account')}</h1>
            <p className="text-dark-100 text-sm">Join thousands of customers saving time</p>
          </div>

          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={async () => {
              try {
                setLoading(true)
                await signInWithGoogle()
              } catch (err) {
                showError('Could not sign in with Google.')
                setLoading(false)
              }
            }}
            disabled={loading}
            className="flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 border-transparent shadow-glow-sm py-4 mb-6 transition-transform hover:-translate-y-1"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="font-bold text-[15px]">{t('auth.continue_google')}</span>
          </Button>

          {!showEmailForm ? (
            <div className="text-center animate-fade-in">
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.08]"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-surface-secondary text-dark-200">{t('auth.or')}</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowEmailForm(true)}
                className="text-dark-100 hover:text-white text-sm font-medium transition-colors"
              >
                {t('auth.sign_up_email')}
              </button>
            </div>
          ) : (
            <div className="animate-fade-in">
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.08]"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-surface-secondary text-dark-200">Sign up with email</span>
                </div>
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
                  label={t('auth.email')}
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
                    label={t('auth.password')}
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

                <Button
                  type="submit"
                  id="btn-register"
                  loading={loading}
                  fullWidth
                  className="mt-4"
                >
                  {t('auth.create_account_btn')} <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </form>
            </div>
          )}

          <div className="text-center mt-8 pt-6 border-t border-white/5">
            <p className="text-sm text-dark-100">
              {t('auth.have_account')}{' '}
              <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                {t('auth.sign_in_btn')}
              </Link>
            </p>
            <div className="mt-4">
              <Link to="/register-owner" className="text-sm text-dark-200 hover:text-brand-400 font-medium transition-colors flex items-center justify-center">
                <Store className="w-4 h-4 mr-1.5" />
                {t('auth.register_shop')}
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
