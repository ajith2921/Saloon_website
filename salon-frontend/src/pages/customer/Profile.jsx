import { useState } from 'react'
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
    <div className="container-app max-w-lg mx-auto py-8">
      <h1 className="text-2xl font-bold text-white mb-6">My Profile</h1>

      <div className="flex flex-col gap-4">
        {/* Avatar */}
        <Card className="flex items-center gap-4 p-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center text-2xl font-bold text-white shadow-glow-sm">
            {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="font-bold text-white">{profile?.full_name}</p>
            <p className="text-dark-200 text-sm">{user?.email}</p>
            <span className="inline-block mt-1 text-[10px] uppercase tracking-wider font-semibold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full">
              {profile?.role?.replace('_', ' ')}
            </span>
          </div>
        </Card>

        {/* Edit form */}
        <Card className="p-5">
          <h2 className="text-base font-bold text-white mb-4">Personal Information</h2>
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
            
            <div className="flex items-center justify-between p-4 mt-2 bg-surface-secondary border border-white/10 rounded-2xl">
              <div>
                <p className="font-bold text-white text-sm">SMS Notifications</p>
                <p className="text-xs text-dark-200 mt-0.5 max-w-[200px]">Get texted when you are next in line. Standard rates may apply.</p>
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

            <div className="flex items-center justify-between p-4 bg-surface-secondary border border-white/10 rounded-2xl">
              <div>
                <p className="font-bold text-white text-sm">Email Receipts</p>
                <p className="text-xs text-dark-200 mt-0.5 max-w-[200px]">Automatically receive a receipt when a token completes.</p>
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

            <Button onClick={handleSave} loading={saving} fullWidth className="mt-2">
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </div>
        </Card>

        {/* Loyalty & Referral */}
        <Card className="p-5">
          <h2 className="text-base font-bold text-white mb-4">Loyalty & Referrals</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-tertiary rounded-xl p-3 text-center">
              <Gift className="w-5 h-5 text-brand-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-white">{profile?.loyalty_points ?? 0}</p>
              <p className="text-xs text-dark-200">Loyalty Points</p>
            </div>
            <div className="bg-surface-tertiary rounded-xl p-3 text-center">
              <p className="text-xs text-dark-200 mb-1">Your Referral Code</p>
              <p className="font-mono font-bold text-brand-400 text-sm">{profile?.referral_code ?? '—'}</p>
              <button onClick={copyReferral} className="mt-1 text-[10px] text-dark-200 hover:text-white flex items-center justify-center gap-1 mx-auto transition-colors">
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
