import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { User, Phone, Mail, Save, Gift, Copy } from 'lucide-react'
import { Button, Input, Card } from '../../components/ui'
export default function Profile() {
  const { profile, user, updateProfile } = useAuth()
  const { success, error: showError } = useToast()
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    phone:     profile?.phone ?? '',
    sms_notifications: profile?.sms_notifications ?? false,
    email_receipts: profile?.email_receipts ?? false,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? '',
        phone:     profile.phone ?? '',
        sms_notifications: profile.sms_notifications ?? false,
        email_receipts: profile.email_receipts ?? false,
      })
    }
  }, [profile])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfile(form)
      success('Profile updated successfully!')
    } catch (err) {
      showError(err.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const copyReferral = () => {
    navigator.clipboard.writeText(profile?.referral_code ?? '')
    success('Referral code copied!', '')
  }

  return (
    <div className="container-app max-w-lg mx-auto py-4 sm:py-8 pb-32 sm:pb-8">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">My Profile</h1>

      <div className="flex flex-col gap-4">
        {/* Avatar */}
        <Card className="flex items-center gap-4 p-4 sm:p-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-brand flex items-center justify-center text-xl sm:text-2xl font-bold text-white shadow-glow-sm shrink-0">
            {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white truncate">{profile?.full_name}</p>
            <p className="text-dark-200 text-xs sm:text-sm truncate">{user?.email}</p>
            <span className="inline-block mt-1 text-[10px] uppercase tracking-wider font-semibold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full">
              {profile?.role?.replace('_', ' ')}
            </span>
          </div>
        </Card>

        {/* Edit form */}
        <Card className="p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-bold text-white mb-4">Personal Information</h2>
          <div className="flex flex-col gap-4">
            <Input
              type="text"
              label="Full Name"
              icon={User}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
            <Input
              type="tel"
              label="Phone"
              icon={Phone}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              type="email"
              label="Email"
              icon={Mail}
              value={user?.email ?? ''}
              disabled
              className="opacity-50 cursor-not-allowed"
            />
            
            <div className="flex items-center justify-between p-3.5 sm:p-4 mt-2 bg-surface-secondary border border-white/10 rounded-2xl gap-3">
              <div className="flex-1 min-w-0 pr-2">
                <p className="font-bold text-white text-sm">SMS Notifications</p>
                <p className="text-xs text-dark-200 mt-0.5 leading-relaxed">Get texted when you are next in line. Standard rates may apply.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.sms_notifications}
                onClick={() => setForm({ ...form, sms_notifications: !form.sms_notifications })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-surface-primary ${
                  form.sms_notifications ? 'bg-brand-500' : 'bg-dark-300'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    form.sms_notifications ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 sm:p-4 bg-surface-secondary border border-white/10 rounded-2xl gap-3">
              <div className="flex-1 min-w-0 pr-2">
                <p className="font-bold text-white text-sm">Email Receipts</p>
                <p className="text-xs text-dark-200 mt-0.5 leading-relaxed">Automatically receive a receipt when a token completes.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.email_receipts}
                onClick={() => setForm({ ...form, email_receipts: !form.email_receipts })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-surface-primary ${
                  form.email_receipts ? 'bg-brand-500' : 'bg-dark-300'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    form.email_receipts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <Button onClick={handleSave} loading={saving} fullWidth className="mt-2 py-3">
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </div>
        </Card>


      </div>
    </div>
  )
}
