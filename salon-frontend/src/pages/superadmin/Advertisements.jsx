import { useState } from 'react'
import { Megaphone, Plus, Trash2, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { useFetch } from '../../hooks/useApi'
import { EmptyState, ErrorState, Skeleton, Modal, ConfirmModal, PageHeader, Card, Button, Input, Select } from '../../components/ui'
import api from '../../lib/api'
import { useToast } from '../../context/ToastContext'

const EMPTY_FORM = { title: '', image_url: '', link_url: '', status: 'active' }

/** Skeleton for ad grid */
function AdGridSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-0 flex flex-col overflow-hidden">
          <Skeleton className="h-36 rounded-b-none rounded-t-2xl" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Status badge for ad */
function AdStatusBadge({ status }) {
  return (
    <span className={`badge ${
      status === 'active'
        ? 'bg-green-500/20 text-green-400 border border-green-500/20'
        : 'bg-dark-300/30 text-dark-100 border border-white/10'
    }`}>
      {status === 'active' ? 'Active' : 'Inactive'}
    </span>
  )
}

export default function Advertisements() {
  const { data, loading, error, refetch } = useFetch('/api/advertisements/all')
  const ads = data?.advertisements ?? []

  const { success, error: showError } = useToast()
  const [modalOpen, setModalOpen]     = useState(false)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [togglingId, setTogglingId]   = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const openModal = () => {
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return showError('Title is required')
    if (!form.image_url.trim()) return showError('Image URL is required')
    setSaving(true)
    try {
      await api.post('/api/advertisements', form)
      success('Advertisement created!')
      setModalOpen(false)
      setForm(EMPTY_FORM)
      refetch()
    } catch (err) {
      showError(err.response?.data?.detail || err.message || 'Failed to create ad')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (ad) => {
    setTogglingId(ad.id)
    const newStatus = ad.status === 'active' ? 'inactive' : 'active'
    try {
      await api.put(`/api/advertisements/${ad.id}`, { status: newStatus })
      success(`Ad ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
      refetch()
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to update ad')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/api/advertisements/${deleteTarget.id}`)
      success(`"${deleteTarget.title}" deleted`)
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to delete advertisement')
      setDeleteTarget(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Platform Advertisements"
        subtitle="Manage banners and promotions shown to all customers"
        action={
          <Button onClick={openModal} aria-label="Create new advertisement">
            <Plus className="w-4 h-4" /> Create Ad
          </Button>
        }
      />

      {loading ? (
        <AdGridSkeleton />
      ) : error ? (
        <Card className="p-6">
          <ErrorState
            title="Failed to load advertisements"
            message={error}
            onRetry={refetch}
          />
        </Card>
      ) : ads.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No advertisements yet"
          description="Create a new ad to promote features, deals, or partner brands across all salons."
          action={
            <Button onClick={openModal}>
              <Plus className="w-4 h-4" /> Create First Ad
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map(ad => (
            <div key={ad.id} className="card p-0 flex flex-col overflow-hidden">
              {/* Image area */}
              <div className="h-36 bg-surface-tertiary flex items-center justify-center relative overflow-hidden">
                {ad.image_url ? (
                  <img
                    src={ad.image_url}
                    alt={ad.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                ) : (
                  <Megaphone className="w-8 h-8 text-dark-300" aria-hidden="true" />
                )}
                <div className="absolute top-2 right-2">
                  <AdStatusBadge status={ad.status} />
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="text-base font-bold text-white mb-1 line-clamp-1">{ad.title}</h3>
                {ad.link_url && (
                  <a
                    href={ad.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mb-3 truncate"
                    aria-label={`Open link: ${ad.link_url}`}
                  >
                    <ExternalLink className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                    {ad.link_url}
                  </a>
                )}
                <div className="mt-auto flex justify-between gap-2 pt-2 border-t border-white/[0.06]">
                  {/* Toggle status */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(ad)}
                    loading={togglingId === ad.id}
                    className={`text-xs ${ad.status === 'active' ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10' : 'text-green-400 hover:text-green-300 hover:bg-green-500/10'}`}
                    aria-label={ad.status === 'active' ? `Deactivate ${ad.title}` : `Activate ${ad.title}`}
                  >
                    {ad.status === 'active'
                      ? <><EyeOff className="w-3.5 h-3.5" /> Deactivate</>
                      : <><Eye className="w-3.5 h-3.5" /> Activate</>
                    }
                  </Button>

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(ad)}
                    className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    aria-label={`Delete ${ad.title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Ad Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Advertisement">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label htmlFor="ad-title" className="input-label">Title *</label>
            <Input
              id="ad-title"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              placeholder="e.g. 50% Off Beard Trims This Weekend!"
            />
          </div>

          <div>
            <label htmlFor="ad-image-url" className="input-label">Image URL *</label>
            <Input
              id="ad-image-url"
              name="image_url"
              value={form.image_url}
              onChange={handleChange}
              required
              placeholder="https://…"
            />
            {form.image_url && (
              <img
                src={form.image_url}
                alt="Preview"
                className="mt-2 w-full h-24 object-cover rounded-xl border border-white/10"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            )}
          </div>

          <div>
            <label htmlFor="ad-link-url" className="input-label">Link URL <span className="text-dark-300 font-normal">(optional)</span></label>
            <Input
              id="ad-link-url"
              name="link_url"
              value={form.link_url}
              onChange={handleChange}
              placeholder="https://…"
            />
          </div>

          <div>
            <label htmlFor="ad-status" className="input-label">Status</label>
            <Select id="ad-status" name="status" value={form.status} onChange={handleChange}>
              <option value="active">Active (visible to customers)</option>
              <option value="inactive">Inactive (hidden)</option>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} fullWidth>
              Cancel
            </Button>
            <Button type="submit" loading={saving} fullWidth>
              Create Ad
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete confirmation ── */}
      <ConfirmModal
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={`Delete "${deleteTarget?.title}"?`}
        message="This advertisement will be permanently removed from the platform. Customers currently viewing this ad will no longer see it."
        confirmLabel="Yes, Delete Ad"
        danger
      />
    </div>
  )
}
