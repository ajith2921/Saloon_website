import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Scissors, Mail, Lock, Eye, EyeOff, ArrowRight, Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Button, Input, Card } from '../../components/ui'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const { t } = useTranslation()
  const { signIn, signInWithGoogle } = useAuth()
  const { success, error: showError } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname ?? '/'

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
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
          <h1 className="text-2xl font-bold text-white">{t('auth.welcome_back')}</h1>
          <p className="text-dark-100 text-sm mt-1">Sign in to your QueueCut account</p>
        </div>

        <Card>
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
                {t('auth.sign_in_email')}
              </button>
            </div>
          ) : (
            <div className="animate-fade-in">
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.08]"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-surface-secondary text-dark-200">{t('auth.sign_in_email')}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                {/* Email */}
                <Input
                  id="email"
                  type="email"
                  label={t('auth.email')}
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
                      label={t('auth.password')}
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
                      {t('auth.forgot_password')}
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
                  {t('auth.sign_in_btn')} <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </form>
            </div>
          )}

          <div className="text-center mt-8 pt-6 border-t border-white/5">
            <p className="text-sm text-dark-100">
              {t('auth.no_account')}{' '}
              <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                {t('auth.create_account_btn')}
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
