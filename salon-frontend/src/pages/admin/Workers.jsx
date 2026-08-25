import { useState } from 'react'
import { Plus, Edit2, Trash2, Scissors, Star } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSalonWorkers } from '../../hooks/useApi'
import { Modal, ConfirmModal, PageHeader, Card, Button, Input, Select, EmptyState, Skeleton } from '../../components/ui'
import NoSalonEmptyState from '../../components/ui/NoSalonEmptyState'
import api from '../../lib/api'
import { useToast } from '../../context/ToastContext'

const EMPTY_FORM = {
  name: '',
  specialization: '',
  experience_years: 0,
  status: 'active',
  photo_url: '',
}

export default function Workers() {
  const { profile } = useAuth()
  const salonId = profile?.salons?.[0]?.id
  const { data, loading, refetch } = useSalonWorkers(salonId)
  const workers = data?.workers ?? []

  const { success, error: showError } = useToast()
  
  if (!salonId && !loading) return <NoSalonEmptyState />
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)   // null = adding new
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null) // worker to confirm delete

  const handleOpen = (worker = null) => {
    setEditing(worker)
    setForm(worker
      ? {
          name: worker.name ?? '',
          specialization: worker.specialization ?? '',
          experience_years: worker.experience_years ?? 0,
          status: worker.status ?? 'active',
          photo_url: worker.photo_url ?? '',
        }
      : EMPTY_FORM
    )
    setModalOpen(true)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: name === 'experience_years' ? Number(value) : value }))
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

          {/* Photo URL */}
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1.5" htmlFor="worker-photo">Photo URL (optional)</label>
            <Input
              id="worker-photo"
              name="photo_url"
              value={form.photo_url}
              onChange={handleChange}
              placeholder="https://..."
            />
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
    </div>
  )
}
