import { useState } from 'react'
import { Plus, Edit2, Trash2, Clock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSalonServices } from '../../hooks/useApi'
import { Modal, ConfirmModal, PageHeader, Card, Button, Input, Textarea, Select, EmptyState, Skeleton } from '../../components/ui'
import NoSalonEmptyState from '../../components/ui/NoSalonEmptyState'
import api from '../../lib/api'
import { useToast } from '../../context/ToastContext'

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  duration_minutes: '',
  status: 'active',
}

export default function Services() {
  const { profile } = useAuth()
  const salonId = profile?.salons?.[0]?.id
  const { data, loading, refetch } = useSalonServices(salonId)
  const services = data?.services ?? []

  const { success, error: showError } = useToast()
  
  if (!salonId && !loading) return <NoSalonEmptyState />
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const handleOpen = (service = null) => {
    setEditing(service)
    setForm(service
      ? {
          name: service.name ?? '',
          description: service.description ?? '',
          price: service.price ?? '',
          duration_minutes: service.duration_minutes ?? '',
          status: service.status ?? 'active',
        }
      : EMPTY_FORM
    )
    setModalOpen(true)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return showError('Service name is required')
    const price = parseFloat(form.price)
    const duration = parseInt(form.duration_minutes)
    if (isNaN(price) || price <= 0) return showError('Enter a valid price')
    if (isNaN(duration) || duration <= 0) return showError('Enter a valid duration in minutes')

    setSaving(true)
    try {
      if (editing) {
        const payload = {
          name: form.name,
          description: form.description || null,
          price,
          duration_minutes: duration,
          status: form.status,
        }
        await api.put(`/api/services/${editing.id}`, payload)
        success('Service updated successfully')
      } else {
        const payload = {
          salon_id: salonId,
          name: form.name,
          description: form.description || null,
          price,
          duration_minutes: duration,
          status: form.status,
        }
        await api.post('/api/services', payload)
        success('Service added successfully')
      }
      setModalOpen(false)
      refetch()
    } catch (err) {
      showError(err.response?.data?.detail || err.message || 'Failed to save service')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/api/services/${deleteTarget.id}`)
      success(`"${deleteTarget.name}" removed from menu`)
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      showError(err.response?.data?.detail || err.message || 'Failed to delete service')
      setDeleteTarget(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader 
        title="Services Menu"
        description="Manage haircuts, treatments, and pricing"
        action={
          <Button onClick={() => handleOpen()}>
            <Plus className="w-4 h-4 mr-1" /> Add Service
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : services.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No services yet"
          description="Add your first service so customers can book tokens."
          action={
            <Button onClick={() => handleOpen()} className="mt-4">
              <Plus className="w-4 h-4 mr-1" /> Add First Service
            </Button>
          }
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Services menu — {services.length} service{services.length !== 1 ? 's' : ''}</caption>
            <thead>
              <tr className="bg-surface-tertiary text-dark-200 border-b border-white/[0.06]">
                <th scope="col" className="p-4 font-medium">Service Name</th>
                <th scope="col" className="p-4 font-medium">Duration</th>
                <th scope="col" className="p-4 font-medium">Price</th>
                <th scope="col" className="p-4 font-medium">Status</th>
                <th scope="col" className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {services.map((s) => (
                <tr key={s.id} className="text-white hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-medium">
                    <div>
                      <p>{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-dark-200 mt-0.5 truncate max-w-[200px]">{s.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-dark-100">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {s.duration_minutes}m
                    </span>
                  </td>
                  <td className="p-4 font-bold text-brand-400">₹{s.price}</td>
                  <td className="p-4">
                    <span className={`badge ${s.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-dark-300/30 text-dark-100'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="p-4 flex justify-end gap-2">
                    <Button
                      variant="icon"
                      onClick={() => handleOpen(s)}
                      aria-label={`Edit ${s.name}`}
                    >
                      <Edit2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="icon"
                      onClick={() => setDeleteTarget(s)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      aria-label={`Delete ${s.name}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit "${editing.name}"` : 'Add Service'}
        titleId="service-modal-title"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1.5" htmlFor="svc-name">Service Name <span aria-label="required">*</span></label>
            <Input
              id="svc-name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Haircut & Styling"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1.5" htmlFor="svc-desc">Description (optional)</label>
            <Textarea
              id="svc-desc"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Brief description of this service..."
              rows={2}
            />
          </div>

          {/* Price & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-100 mb-1.5" htmlFor="svc-price">Price (₹) <span aria-label="required">*</span></label>
              <Input
                id="svc-price"
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                placeholder="150"
                min={1}
                step={0.01}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-100 mb-1.5" htmlFor="svc-duration">Duration (min) <span aria-label="required">*</span></label>
              <Input
                id="svc-duration"
                type="number"
                name="duration_minutes"
                value={form.duration_minutes}
                onChange={handleChange}
                placeholder="30"
                min={1}
                max={480}
                required
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1.5" htmlFor="svc-status">Status</label>
            <Select
              id="svc-status"
              name="status"
              value={form.status}
              onChange={handleChange}
            >
              <option value="active">Active (visible to customers)</option>
              <option value="inactive">Inactive (hidden from customers)</option>
            </Select>
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
              {editing ? 'Save Changes' : 'Add Service'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={`Delete "${deleteTarget?.name}"?`}
        message="This will permanently remove this service from your menu. Existing tokens using this service will not be affected."
        confirmLabel="Yes, Delete"
        danger
      />
    </div>
  )
}
