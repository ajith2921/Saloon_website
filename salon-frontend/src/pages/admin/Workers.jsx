import { useState } from 'react'
import { Plus, Edit2, Trash2, Scissors, Star, Key, Image } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSalonWorkers } from '../../hooks/useApi'
import { Modal, ConfirmModal, PageHeader, Card, Button, Input, Select, EmptyState, Skeleton } from '../../components/ui'
import NoSalonEmptyState from '../../components/ui/NoSalonEmptyState'
import api from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'

const EMPTY_FORM = {
  name: '',
  specialization: '',
  experience_years: 0,
  status: 'active',
  photo_url: '',
  shift_start: '09:00',
  shift_end: '17:00',
  working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Workers() {
  const { profile } = useAuth()
  const salonId = profile?.salons?.[0]?.id
  const { data, loading, refetch } = useSalonWorkers(salonId)
  const workers = data?.workers ?? []

  const { success, error: showError } = useToast()
  
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)   // null = adding new
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null) // worker to confirm delete
  const [provisionTarget, setProvisionTarget] = useState(null)
  const [provisionForm, setProvisionForm] = useState({ email: '', password: '' })
  const [provisioning, setProvisioning] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      showError('Image must be less than 5MB')
      return
    }

    setUploadingImage(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${salonId}_worker_${Math.random().toString(36).slice(2)}.${fileExt}`
      
      const { error: uploadError } = await supabase
        .storage.from('salon-images')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase
        .storage.from('salon-images').getPublicUrl(fileName)

      setForm(f => ({ ...f, photo_url: publicUrl }))
      success('Photo uploaded successfully!')
    } catch (err) {
      showError('Failed to upload photo')
      console.error(err)
    } finally {
      setUploadingImage(false)
    }
  }

  if (!salonId && !loading) return <NoSalonEmptyState />

  const handleOpen = (worker = null) => {
    setEditing(worker)
    setForm(worker
      ? {
          name: worker.name ?? '',
          specialization: worker.specialization ?? '',
          experience_years: worker.experience_years ?? 0,
          status: worker.status ?? 'active',
          photo_url: worker.photo_url ?? '',
          shift_start: worker.shift_start ?? '09:00',
          shift_end: worker.shift_end ?? '17:00',
          working_days: worker.working_days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        }
      : EMPTY_FORM
    )
    setModalOpen(true)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: name === 'experience_years' ? Number(value) : value }))
  }

  const toggleDay = (day) => {
    setForm(f => ({
      ...f,
      working_days: f.working_days.includes(day)
        ? f.working_days.filter(d => d !== day)
        : [...f.working_days, day]
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return showError('Name is required')
    setSaving(true)
    try {
      if (editing) {
        // Update existing worker
        const payload = {
          name: form.name,
          specialization: form.specialization || null,
          experience_years: form.experience_years,
          status: form.status,
          photo_url: form.photo_url || null,
          shift_start: form.shift_start,
          shift_end: form.shift_end,
          working_days: form.working_days,
        }
        await api.put(`/api/workers/${editing.id}`, payload)
        success('Barber updated successfully')
      } else {
        // Create new worker
        const payload = {
          salon_id: salonId,
          name: form.name,
          specialization: form.specialization || null,
          experience_years: form.experience_years,
          status: form.status,
          photo_url: form.photo_url || null,
          shift_start: form.shift_start,
          shift_end: form.shift_end,
          working_days: form.working_days,
        }
        await api.post('/api/workers', payload)
        success('Barber added successfully')
      }
      setModalOpen(false)
      refetch()
    } catch (err) {
      showError(err.response?.data?.detail || err.message || 'Failed to save barber')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/api/workers/${deleteTarget.id}`)
      success(`${deleteTarget.name} removed from your salon`)
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      showError(err.response?.data?.detail || err.message || 'Failed to remove barber')
      setDeleteTarget(null)
    }
  }

  const handleProvisionSubmit = async (e) => {
    e.preventDefault()
    if (!provisionForm.email || !provisionForm.password) return showError('Email and password required')
    setProvisioning(true)
    try {
      await api.post(`/api/workers/${provisionTarget.id}/provision`, provisionForm)
      success(`Login account created for ${provisionTarget.name}`)
      setProvisionTarget(null)
      setProvisionForm({ email: '', password: '' })
      refetch()
    } catch (err) {
      showError(err.response?.data?.detail || err.message || 'Failed to provision account')
    } finally {
      setProvisioning(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader 
        title="Barbers & Staff"
        description="Manage your salon's workforce"
        action={
          <Button onClick={() => handleOpen()}>
            <Plus className="w-4 h-4 mr-1" /> Add Barber
          </Button>
        }
      />

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : workers.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="No barbers yet"
          description="Add your first barber to get started."
          action={
            <Button onClick={() => handleOpen()} className="mt-4">
              <Plus className="w-4 h-4 mr-1" /> Add First Barber
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((w) => (
            <Card key={w.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="w-16 h-16 rounded-xl bg-surface-tertiary flex items-center justify-center overflow-hidden border border-white/5">
                  {w.photo_url ? (
                    <img src={w.photo_url} className="w-full h-full object-cover" alt={w.name} />
                  ) : (
                    <div className="w-full h-full bg-gradient-brand flex items-center justify-center">
                      <span className="text-xl font-bold text-white select-none">
                        {w.name?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                  )}
                </div>
                <span className={`badge ${w.status === 'active' ? 'bg-green-500/15 text-green-400' : w.status === 'on_break' ? 'bg-amber-500/15 text-amber-400' : 'bg-dark-300/30 text-dark-100'}`}>
                  {w.status === 'on_break' ? 'On Break' : w.status}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">{w.name}</h3>
              <p className="text-sm text-dark-100 mb-2">{w.specialization || '—'}</p>

              <div className="flex items-center gap-4 text-xs text-dark-200 mt-auto pt-4 border-t border-white/[0.06]">
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-white font-medium">{w.avg_rating ?? '—'}</span>
                </div>
                <div>{w.experience_years} yrs exp</div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant="secondary"
                  onClick={() => handleOpen(w)}
                  className="flex-1 py-1.5 text-xs h-auto"
                  aria-label={`Edit ${w.name}`}
                >
                  <Edit2 className="w-3 h-3 mr-1" aria-hidden="true" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setDeleteTarget(w)}
                  className="flex-1 py-1.5 text-xs h-auto text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  aria-label={`Remove ${w.name}`}
                >
                  <Trash2 className="w-3 h-3 mr-1" aria-hidden="true" /> Remove
                </Button>
              </div>
              
              {!w.user_id ? (
                <Button
                  variant="outline"
                  onClick={() => setProvisionTarget(w)}
                  className="w-full mt-2 py-1.5 text-xs h-auto border-brand-500/30 text-brand-400 hover:bg-brand-500/10"
                >
                  <Key className="w-3 h-3 mr-1" /> Create Login Portal
                </Button>
              ) : (
                <div className="mt-2 py-1.5 text-xs text-center text-green-400 bg-green-400/10 rounded-lg border border-green-400/20">
                  Worker Portal Active
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add Barber'}
        titleId="worker-modal-title"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1.5" htmlFor="worker-name">Full Name <span aria-label="required">*</span></label>
            <Input
              id="worker-name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Arun Kumar"
              required
            />
          </div>

          {/* Specialization */}
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1.5" htmlFor="worker-spec">Specialization</label>
            <Input
              id="worker-spec"
              name="specialization"
              value={form.specialization}
              onChange={handleChange}
              placeholder="e.g. Haircut & Styling"
            />
          </div>

          {/* Experience & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-100 mb-1.5" htmlFor="worker-exp">Experience (yrs)</label>
              <Input
                id="worker-exp"
                type="number"
                name="experience_years"
                value={form.experience_years}
                onChange={handleChange}
                min={0}
                max={50}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-100 mb-1.5" htmlFor="worker-status">Status</label>
              <Select
                id="worker-status"
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                <option value="active">Active</option>
                <option value="on_break">On Break</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1.5">Worker Photo (optional)</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-surface-tertiary flex items-center justify-center overflow-hidden border border-white/5 shrink-0">
                {form.photo_url ? (
                  <img src={form.photo_url} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Image className="w-6 h-6 text-dark-300" />
                )}
              </div>
              <div className="flex-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="text-sm cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-500/10 file:text-brand-400 hover:file:bg-brand-500/20"
                />
                <p className="text-xs text-dark-300 mt-1">
                  {uploadingImage ? 'Uploading...' : 'Recommended size: 256x256px. Max 5MB.'}
                </p>
              </div>
            </div>
          </div>

          {/* Shift Schedule */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-100 mb-1.5" htmlFor="worker-shift-start">Shift Start</label>
              <Input
                id="worker-shift-start"
                type="time"
                name="shift_start"
                value={form.shift_start}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-100 mb-1.5" htmlFor="worker-shift-end">Shift End</label>
              <Input
                id="worker-shift-end"
                type="time"
                name="shift_end"
                value={form.shift_end}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Working Days */}
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-2">Working Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1 text-sm font-medium rounded-full border transition-colors ${
                    form.working_days.includes(day)
                      ? 'bg-brand-500/20 border-brand-500 text-brand-400'
                      : 'bg-surface-tertiary border-white/5 text-dark-200 hover:text-white'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              loading={saving}
              className="flex-1"
            >
              {editing ? 'Save Changes' : 'Add Barber'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={`Remove ${deleteTarget?.name}?`}
        message="This will permanently remove this barber from your salon. Any existing tokens assigned to them will not be affected."
        confirmLabel="Yes, Remove"
        danger
      />

      {/* Provision Worker Modal */}
      <Modal
        open={!!provisionTarget}
        onClose={() => setProvisionTarget(null)}
        title="Create Worker Login"
      >
        <form onSubmit={handleProvisionSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-dark-200">
            Create a login account for <strong>{provisionTarget?.name}</strong> so they can access their personal Worker Portal to view their queue.
          </p>
          
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1.5" htmlFor="provision-email">Email Address <span aria-label="required">*</span></label>
            <Input
              id="provision-email"
              type="email"
              value={provisionForm.email}
              onChange={(e) => setProvisionForm({ ...provisionForm, email: e.target.value })}
              placeholder="worker@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1.5" htmlFor="provision-password">Temporary Password <span aria-label="required">*</span></label>
            <Input
              id="provision-password"
              type="text"
              value={provisionForm.password}
              onChange={(e) => setProvisionForm({ ...provisionForm, password: e.target.value })}
              placeholder="e.g. Temp1234!"
              required
              minLength={6}
            />
            <p className="text-xs text-dark-300 mt-1">They can use this to log in at /login.</p>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setProvisionTarget(null)}
              disabled={provisioning}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={provisioning}
            >
              Create Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
