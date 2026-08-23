import { useState, useEffect } from 'react'
import { Save, Store, Clock, Users, Phone, Mail, MapPin, Image } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSalon } from '../../hooks/useApi'
import { Spinner, Input, Textarea, Button } from '../../components/ui'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'

function Field({ label, icon: Icon, htmlFor, children }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-sm font-medium text-dark-100 mb-1.5"
      >
        {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
        {label}
      </label>
      {children}
    </div>
  )
}



function LocationPicker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition({ latitude: e.latlng.lat, longitude: e.latlng.lng })
    },
  })
  return position ? <Marker position={position} /> : null
}

export default function Settings() {
  const { profile } = useAuth()
  const salonId = profile?.salons?.[0]?.id

  const { data: salon, loading } = useSalon(salonId)
  const { success, error: showError } = useToast()

  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  // Populate form once salon data loads
  useEffect(() => {
    if (salon) {
      setForm({
        name: salon.name ?? '',
        description: salon.description ?? '',
        address: salon.address ?? '',
        city: salon.city ?? '',
        phone: salon.phone ?? '',
        email: salon.email ?? '',
        opening_time: salon.opening_time ?? '09:00',
        closing_time: salon.closing_time ?? '21:00',
        max_daily_tokens: salon.max_daily_tokens ?? 50,
        avg_service_minutes: salon.avg_service_minutes ?? 30,
        logo_url: salon.logo_url ?? '',
        cover_image_url: salon.cover_image_url ?? '',
        latitude: salon.latitude || null,
        longitude: salon.longitude || null,
      })
    }
  }, [salon])

  const handleChange = (e) => {
    const { name, value, type } = e.target
    setForm(f => ({
      ...f,
      [name]: type === 'number' ? Number(value) : value
    }))
  }

  const handleImageUpload = async (e, field) => {
    const file = e.target.files?.[0]
    if (!file || !salonId) return

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      showError('Image must be less than 5MB')
      return
    }

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${salonId}_${field}_${Math.random().toString(36).slice(2)}.${fileExt}`
      
      const { error: uploadError } = await supabase
        .storage.from('salon-images')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase
        .storage.from('salon-images').getPublicUrl(fileName)

      setForm(f => ({ ...f, [field]: publicUrl }))
      success(`${field === 'logo_url' ? 'Logo' : 'Cover image'} uploaded successfully!`)
    } catch (err) {
      showError('Failed to upload image')
      console.error(err)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!salonId) return
    setSaving(true)
    try {
      await api.put(`/api/salons/${salonId}`, form)
      success('Salon settings saved successfully!')
    } catch (err) {
      showError(err.response?.data?.detail || err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) return (
    <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  )

  if (!salonId) return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-2">Salon Settings</h1>
      <p className="text-dark-100">Your account is not linked to a salon. Please contact support.</p>
    </div>
  )

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Salon Settings</h1>
          <p className="text-dark-100 text-sm mt-0.5">Update your salon's public profile and operating configuration</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">

        {/* ── Basic Info ── */}
        <div className="card p-6">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Store className="w-4 h-4 text-brand-400" /> Basic Information
          </h2>
          <div className="flex flex-col gap-4">
            <Field label="Salon Name" icon={Store} htmlFor="settings-name">
              <Input id="settings-name" name="name" value={form.name} onChange={handleChange} required
                placeholder="e.g. Ajith Men's Salon" />
            </Field>

            <Field label="Description" htmlFor="settings-desc">
              <Textarea id="settings-desc" name="description" value={form.description} onChange={handleChange}
                rows={3} className="resize-none"
                placeholder="Brief description of your salon and services..." />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Phone" icon={Phone} htmlFor="settings-phone">
                <Input id="settings-phone" name="phone" value={form.phone} onChange={handleChange}
                  placeholder="+91 98765 43210" />
              </Field>
              <Field label="Email" icon={Mail} htmlFor="settings-email">
                <Input id="settings-email" name="email" type="email" value={form.email} onChange={handleChange}
                  placeholder="salon@example.com" />
              </Field>
            </div>

            <Field label="Address" icon={MapPin} htmlFor="settings-address">
              <Input id="settings-address" name="address" value={form.address} onChange={handleChange}
                placeholder="123 Main Street, Area" />
            </Field>

            <Field label="City" htmlFor="settings-city">
              <Input id="settings-city" name="city" value={form.city} onChange={handleChange}
                placeholder="e.g. Nagercoil" />
            </Field>

            <Field label="Map Location" icon={MapPin}>
              <div className="h-64 rounded-xl overflow-hidden border border-white/10 relative z-0">
                <MapContainer 
                  center={form.latitude && form.longitude ? [form.latitude, form.longitude] : [8.1833, 77.4119]} 
                  zoom={13} 
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <LocationPicker 
                    position={form.latitude && form.longitude ? [form.latitude, form.longitude] : null} 
                    setPosition={({ latitude, longitude }) => setForm(f => ({ ...f, latitude, longitude }))} 
                  />
                </MapContainer>
              </div>
              <p className="text-xs text-dark-300 mt-1">Click anywhere on the map to pin your exact location.</p>
            </Field>
          </div>
        </div>

        {/* ── Operating Hours ── */}
        <div className="card p-6">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" /> Operating Hours
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Opening Time" htmlFor="settings-opening">
              <Input type="time" id="settings-opening" name="opening_time" value={form.opening_time} onChange={handleChange} />
            </Field>
            <Field label="Closing Time" htmlFor="settings-closing">
              <Input type="time" id="settings-closing" name="closing_time" value={form.closing_time} onChange={handleChange} />
            </Field>
          </div>
        </div>

        {/* ── Queue Configuration ── */}
        <div className="card p-6">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" /> Queue Configuration
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Max Daily Tokens" htmlFor="settings-max-tokens">
              <Input type="number" id="settings-max-tokens" name="max_daily_tokens" value={form.max_daily_tokens}
                onChange={handleChange} min={1} max={500} />
              <p className="text-xs text-dark-300 mt-1">Maximum tokens accepted per day across all customers.</p>
            </Field>
            <Field label="Avg Service Duration (minutes)" htmlFor="settings-avg-svc">
              <Input type="number" id="settings-avg-svc" name="avg_service_minutes" value={form.avg_service_minutes}
                onChange={handleChange} min={1} max={240} />
              <p className="text-xs text-dark-300 mt-1">Used to calculate ETA for waiting customers.</p>
            </Field>
          </div>
        </div>

        {/* ── Images ── */}
        <div className="card p-6">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Image className="w-4 h-4 text-green-400" /> Images
          </h2>
          <div className="flex flex-col gap-4">
            <Field label="Logo Image" htmlFor="settings-logo-upload">
              <input
                id="settings-logo-upload"
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'logo_url')}
                className="block w-full text-sm text-dark-100 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-500/10 file:text-brand-400 hover:file:bg-brand-500/20 transition-all cursor-pointer"
              />
              {form.logo_url && (
                <img src={form.logo_url} alt="Salon logo preview" className="mt-3 w-16 h-16 rounded-xl object-cover border border-white/10" />
              )}
            </Field>
            <Field label="Cover Image" htmlFor="settings-cover-upload">
              <input
                id="settings-cover-upload"
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'cover_image_url')}
                className="block w-full text-sm text-dark-100 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-500/10 file:text-brand-400 hover:file:bg-brand-500/20 transition-all cursor-pointer"
              />
              {form.cover_image_url && (
                <img src={form.cover_image_url} alt="Salon cover image preview" className="mt-3 w-full h-32 rounded-xl object-cover border border-white/10" />
              )}
            </Field>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <Button type="submit" loading={saving} className="px-8 min-w-[160px]" icon={Save}>
            Save Settings
          </Button>
        </div>

      </form>
    </div>
  )
}
