import { useState } from 'react'
import { Building2, Search, Check, Ban, X, Filter } from 'lucide-react'
import { useFetch } from '../../hooks/useApi'
import { Skeleton, EmptyState, ErrorState, PageHeader, Card, Button, Input, Select, ConfirmModal, Modal } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import api from '../../lib/api'

/** Descriptive confirm messages per action */
const ACTION_MESSAGES = {
  approve: {
    title: 'Approve this salon?',
    message: 'This salon will become active and visible to customers on the platform. The owner will be able to manage their queue immediately.',
    confirmLabel: 'Yes, Approve',
    danger: false,
  },
  suspend: {
    title: 'Suspend this salon?',
    message: 'Customers will no longer be able to view or book tokens at this salon until it is reactivated. Existing active tokens will not be automatically cancelled.',
    confirmLabel: 'Yes, Suspend',
    danger: true,
  },
}

/** Status badge component — consistent, capitalized */
function StatusBadge({ status }) {
  const styles = {
    active:    'bg-green-500/15 text-green-400 border border-green-500/20',
    pending:   'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    suspended: 'bg-red-500/15 text-red-400 border border-red-500/20',
    inactive:  'bg-dark-300/20 text-dark-200 border border-white/10',
  }
  const labels = {
    active:    'Active',
    pending:   'Pending',
    suspended: 'Suspended',
    inactive:  'Inactive',
  }
  const cls = styles[status] ?? 'bg-dark-300/20 text-dark-200'
  const label = labels[status] ?? status
  return <span className={`badge ${cls}`}>{label}</span>
}

/** Table skeleton */
function TableSkeleton() {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 bg-surface-tertiary border-b border-white/[0.06]">
        <div className="flex gap-8">
          {['Salon', 'Location', 'Owner', 'Status', 'Joined', 'Actions'].map(h => (
            <Skeleton key={h} className="h-3.5 w-16" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-4 py-4 flex items-center gap-8">
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
              <Skeleton className="h-3.5 w-28" />
            </div>
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-8 w-20 rounded-xl ml-auto" />
          </div>
        ))}
      </div>
    </Card>
  )
}

const STATUS_OPTIONS = [
  { value: 'all',       label: 'All Statuses' },
  { value: 'active',    label: 'Active' },
  { value: 'pending',   label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive',  label: 'Inactive' },
]

function GrantSubscriptionModal({ salon, onClose, onRefresh }) {
  const { data, loading } = useFetch('/api/subscriptions/plans')
  const plans = data || []
  const [selectedPlan, setSelectedPlan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { success, error } = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedPlan) return
    setSubmitting(true)
    try {
      await api.post(`/api/super-admin/salons/${salon.id}/grant-subscription`, { plan_id: selectedPlan })
      success(`Subscription granted to ${salon.name}`)
      onRefresh()
      onClose()
    } catch (err) {
      error(err.response?.data?.detail || 'Failed to grant subscription')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={!!salon} onClose={onClose} title={`Grant Subscription: ${salon?.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Select Plan"
          value={selectedPlan}
          onChange={(e) => setSelectedPlan(e.target.value)}
          required
        >
          <option value="">-- Choose a plan --</option>
          {plans.map(p => (
            <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
          ))}
        </Select>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={submitting || loading}>Grant Subscription</Button>
        </div>
      </form>
    </Modal>
  )
}

function UpdateTokenLimitModal({ salon, onClose, onRefresh }) {
  const [limit, setLimit] = useState(salon?.currentLimit || 50)
  const [submitting, setSubmitting] = useState(false)
  const { success, error } = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post(`/api/super-admin/salons/${salon.id}/update-token-limit`, { new_limit: parseInt(limit, 10) })
      success(`Token limit updated for ${salon.name}`)
      onRefresh()
      onClose()
    } catch (err) {
      error(err.response?.data?.detail || 'Failed to update token limit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={!!salon} onClose={onClose} title={`Update Token Limit: ${salon?.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="number"
          label="Max Daily Tokens"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          required
          min="1"
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={submitting}>Update Limit</Button>
        </div>
      </form>
    </Modal>
  )
}


export default function Salons() {
  const { data, loading, error, refetch } = useFetch('/api/super-admin/salons')
  const salons = data?.salons ?? []

  const { success, error: showError } = useToast()
  const [searchTerm, setSearchTerm]   = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // { id, name, action }
  const [subscriptionModal, setSubscriptionModal] = useState(null) // { id, name }
  const [tokenLimitModal, setTokenLimitModal] = useState(null) // { id, name, currentLimit }

  /** Fire the confirmed action */
  const executeAction = async () => {
    if (!confirmAction) return
    const { id, name, action } = confirmAction
    setConfirmAction(null)
    setActionLoading(id)
    try {
      await api.post(`/api/super-admin/salons/${id}/${action}`)
      success(`${name} ${action === 'approve' ? 'approved' : 'suspended'} successfully`)
      refetch()
    } catch (err) {
      showError(err.response?.data?.detail || err.message || 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  /** Filter salons based on search + status */
  const filtered = salons.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.city ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.profiles?.full_name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const hasFilters = searchTerm !== '' || statusFilter !== 'all'

  const resetFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return '—'
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Platform Salons"
        subtitle="Manage all registered salons on the platform"
      />

      {/* Search + Filter row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-200 pointer-events-none z-10" aria-hidden="true" />
          <Input
            type="text"
            placeholder="Search by name, city, or owner…"
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search salons"
          />
          {searchTerm && (
            <Button
              variant="icon"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-300 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Filter className="w-4 h-4 text-dark-300 flex-shrink-0" aria-hidden="true" />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            wrapperClassName="w-40"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            onClick={resetFilters}
            className="text-xs flex items-center gap-1.5 flex-shrink-0"
            aria-label="Reset all filters"
          >
            <X className="w-3.5 h-3.5" /> Reset
          </Button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <Card className="p-6">
          <ErrorState
            title="Failed to load salons"
            message={error}
            onRetry={refetch}
          />
        </Card>
      ) : salons.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={Building2}
            title="No salons registered"
            description="Salon registrations will appear here once owners sign up on the platform."
          />
        </Card>
      ) : (
        <>
          {/* Results count */}
          <p className="text-xs text-dark-200 mb-3">
            {hasFilters
              ? `Showing ${filtered.length} of ${salons.length} salons`
              : `${salons.length} salon${salons.length !== 1 ? 's' : ''} registered`
            }
          </p>

          <Card className="p-0 overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead>
                <tr className="bg-surface-tertiary text-dark-200 border-b border-white/[0.06]">
                  <th className="p-4 font-semibold">Salon</th>
                  <th className="p-4 font-semibold">Location</th>
                  <th className="p-4 font-semibold">Owner</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Joined</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16">
                      <EmptyState
                        icon={Search}
                        title="No salons match your filters"
                        description={`No salons found for "${searchTerm || statusFilter}". Try adjusting your search or filter.`}
                        action={
                          <Button variant="secondary" onClick={resetFilters} className="text-sm">
                            Reset Filters
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filtered.map(s => (
                    <tr key={s.id} className="text-white hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-surface-tertiary border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-dark-200" aria-hidden="true" />
                          </div>
                          <span className="font-semibold truncate max-w-[140px]">{s.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-dark-100">{s.city ?? '—'}</td>
                      <td className="p-4 text-dark-100">{s.profiles?.full_name ?? '—'}</td>
                      <td className="p-4"><StatusBadge status={s.status} /></td>
                      <td className="p-4 text-dark-200 text-xs">{formatDate(s.created_at)}</td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSubscriptionModal({ id: s.id, name: s.name })}
                            className="text-brand-400 hover:text-brand-300 hover:bg-brand-500/10"
                            aria-label={`Grant subscription to ${s.name}`}
                          >
                            Grant Plan
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTokenLimitModal({ id: s.id, name: s.name, currentLimit: s.max_daily_tokens })}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            aria-label={`Update tokens for ${s.name}`}
                          >
                            Set Tokens
                          </Button>
                          {s.status === 'pending' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setConfirmAction({ id: s.id, name: s.name, action: 'approve' })}
                              loading={actionLoading === s.id}
                              className="text-green-400 hover:text-green-300 border-green-500/20 hover:border-green-500/40"
                              aria-label={`Approve ${s.name}`}
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </Button>
                          )}
                          {s.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmAction({ id: s.id, name: s.name, action: 'suspend' })}
                              loading={actionLoading === s.id}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              aria-label={`Suspend ${s.name}`}
                            >
                              <Ban className="w-3.5 h-3.5" /> Suspend
                            </Button>
                          )}
                          {s.status === 'suspended' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setConfirmAction({ id: s.id, name: s.name, action: 'approve' })}
                              loading={actionLoading === s.id}
                              className="text-green-400 hover:text-green-300"
                              aria-label={`Reactivate ${s.name}`}
                            >
                              <Check className="w-3.5 h-3.5" /> Reactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* Confirmation dialog — appears for both approve and suspend */}
      {confirmAction && ACTION_MESSAGES[confirmAction.action] && (
        <ConfirmModal
          open={!!confirmAction}
          onCancel={() => setConfirmAction(null)}
          onConfirm={executeAction}
          title={ACTION_MESSAGES[confirmAction.action].title}
          message={`${ACTION_MESSAGES[confirmAction.action].message}`}
          confirmLabel={ACTION_MESSAGES[confirmAction.action].confirmLabel}
          danger={ACTION_MESSAGES[confirmAction.action].danger}
        />
      )}

      {/* Grant Subscription Modal */}
      {subscriptionModal && (
        <GrantSubscriptionModal
          salon={subscriptionModal}
          onClose={() => setSubscriptionModal(null)}
          onRefresh={refetch}
        />
      )}

      {/* Update Token Limit Modal */}
      {tokenLimitModal && (
        <UpdateTokenLimitModal
          salon={tokenLimitModal}
          onClose={() => setTokenLimitModal(null)}
          onRefresh={refetch}
        />
      )}
    </div>
  )
}
