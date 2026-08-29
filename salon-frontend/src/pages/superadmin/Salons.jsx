import { useState } from 'react'
import { Building2, Search, Check, Ban, X, Filter, CreditCard, Coins, ChevronDown } from 'lucide-react'
import { useFetch } from '../../hooks/useApi'
import { Skeleton, EmptyState, ErrorState, PageHeader, Card, Button, Input, Select, ConfirmModal, Modal, Spinner } from '../../components/ui'
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

/** Grant Subscription Modal */
function GrantSubscriptionModal({ open, onClose, salon, onSuccess }) {
  const { data: plansData, loading: plansLoading } = useFetch(open ? '/api/subscriptions/plans' : null)
  const plans = plansData ?? []

  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { success, error: showError } = useToast()

  const handleClose = () => {
    setSelectedPlanId('')
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedPlanId) return
    setSubmitting(true)
    try {
      await api.post(`/api/super-admin/salons/${salon.id}/grant-subscription`, { plan_id: selectedPlanId })
      success(`Subscription granted to ${salon.name} successfully.`)
      handleClose()
      onSuccess?.()
    } catch (err) {
      showError(err.response?.data?.detail || err.message || 'Failed to grant subscription')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedPlan = plans.find(p => p.id === selectedPlanId)

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Grant Subscription"
      size="md"
      titleId="grant-sub-modal-title"
    >
      <div className="flex items-center gap-3 p-3 mb-5 rounded-xl bg-brand-500/10 border border-brand-500/20">
        <CreditCard className="w-4 h-4 text-brand-400 flex-shrink-0" aria-hidden="true" />
        <p className="text-sm text-dark-100">
          Granting a subscription to{' '}
          <span className="font-semibold text-white">{salon?.name}</span>{' '}
          will cancel any existing active subscription and bypass Razorpay billing entirely.
        </p>
      </div>

      <form onSubmit={handleSubmit} id="grant-sub-form">
        <label htmlFor="plan-select" className="block text-sm font-medium text-dark-100 mb-2">
          Select Plan
        </label>

        {plansLoading ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-tertiary border border-white/[0.06]">
            <Spinner size="sm" label="Loading plans…" />
            <span className="text-sm text-dark-200">Loading available plans…</span>
          </div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-dark-200 py-2">No active plans found.</p>
        ) : (
          <Select
            id="plan-select"
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            aria-label="Select subscription plan"
            required
          >
            <option value="" disabled>— Choose a plan —</option>
            {plans.map(plan => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — ₹{plan.price_monthly}/mo
              </option>
            ))}
          </Select>
        )}

        {selectedPlan && (
          <div className="mt-4 p-3 rounded-xl bg-surface-tertiary border border-white/[0.06] space-y-1.5">
            <p className="text-xs font-semibold text-dark-200 uppercase tracking-wide mb-2">Plan Details</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-dark-200">Workers</span>
              <span className="text-white font-medium">{selectedPlan.max_workers ?? '—'}</span>
              <span className="text-dark-200">Services</span>
              <span className="text-white font-medium">{selectedPlan.max_services ?? '—'}</span>
              <span className="text-dark-200">Monthly tokens</span>
              <span className="text-white font-medium">{selectedPlan.max_monthly_tokens ?? '—'}</span>
              <span className="text-dark-200">Advertisements</span>
              <span className="text-white font-medium">{selectedPlan.max_advertisements ?? '—'}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end mt-6">
          <Button variant="ghost" type="button" onClick={handleClose} className="px-5">
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="grant-sub-form"
            loading={submitting}
            disabled={!selectedPlanId || plansLoading}
            className="px-5"
            id="grant-sub-confirm-btn"
          >
            Grant Subscription
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Update Token Limit Modal */
function UpdateTokenLimitModal({ open, onClose, salon, onSuccess }) {
  const [newLimit, setNewLimit] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { success, error: showError } = useToast()

  const currentLimit = salon?.max_daily_tokens ?? '—'

  const handleClose = () => {
    setNewLimit('')
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const limitInt = parseInt(newLimit, 10)
    if (!limitInt || limitInt < 1) return
    setSubmitting(true)
    try {
      await api.post(`/api/super-admin/salons/${salon.id}/update-token-limit`, { new_limit: limitInt })
      success(`Token limit for ${salon.name} updated to ${limitInt}.`)
      handleClose()
      onSuccess?.()
    } catch (err) {
      showError(err.response?.data?.detail || err.message || 'Failed to update token limit')
    } finally {
      setSubmitting(false)
    }
  }

  const newLimitInt = parseInt(newLimit, 10)
  const isValid = !isNaN(newLimitInt) && newLimitInt >= 1

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Update Daily Token Limit"
      size="sm"
      titleId="token-limit-modal-title"
    >
      <div className="flex items-center gap-3 p-3 mb-5 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <Coins className="w-4 h-4 text-amber-400 flex-shrink-0" aria-hidden="true" />
        <p className="text-sm text-dark-100">
          Override the daily queue token limit for{' '}
          <span className="font-semibold text-white">{salon?.name}</span>.
          This bypasses subscription plan limits.
        </p>
      </div>

      <div className="flex items-center justify-between p-3 mb-4 rounded-xl bg-surface-tertiary border border-white/[0.06]">
        <span className="text-sm text-dark-200">Current limit</span>
        <span className="text-sm font-bold text-white">{currentLimit} tokens/day</span>
      </div>

      <form onSubmit={handleSubmit} id="token-limit-form">
        <label htmlFor="new-limit-input" className="block text-sm font-medium text-dark-100 mb-2">
          New Daily Limit
        </label>
        <Input
          id="new-limit-input"
          type="number"
          min={1}
          max={10000}
          placeholder="e.g. 500"
          value={newLimit}
          onChange={(e) => setNewLimit(e.target.value)}
          aria-describedby="token-limit-hint"
          required
        />
        <p id="token-limit-hint" className="text-xs text-dark-300 mt-1.5">
          Enter any value between 1 and 10,000.
        </p>

        {isValid && (
          <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <span className="text-xs text-dark-200 line-through">{currentLimit}</span>
            <span className="text-xs text-dark-300">→</span>
            <span className="text-sm font-bold text-green-400">{newLimitInt} tokens/day</span>
          </div>
        )}

        <div className="flex gap-3 justify-end mt-6">
          <Button variant="ghost" type="button" onClick={handleClose} className="px-5">
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="token-limit-form"
            loading={submitting}
            disabled={!isValid}
            className="px-5"
            id="update-token-limit-confirm-btn"
          >
            Update Limit
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Per-row actions menu — combines status quick-actions with the "More" override dropdown */
function SalonActionsMenu({ salon, actionLoading, onApprove, onSuspend, onGrantSub, onUpdateTokens }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative flex items-center gap-2"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) }}
    >
      {salon.status === 'pending' && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onApprove}
          loading={actionLoading === salon.id}
          className="text-green-400 hover:text-green-300 border-green-500/20 hover:border-green-500/40"
          aria-label={`Approve ${salon.name}`}
        >
          <Check className="w-3.5 h-3.5" /> Approve
        </Button>
      )}
      {salon.status === 'active' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSuspend}
          loading={actionLoading === salon.id}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          aria-label={`Suspend ${salon.name}`}
        >
          <Ban className="w-3.5 h-3.5" /> Suspend
        </Button>
      )}
      {salon.status === 'suspended' && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onApprove}
          loading={actionLoading === salon.id}
          className="text-green-400 hover:text-green-300"
          aria-label={`Reactivate ${salon.name}`}
        >
          <Check className="w-3.5 h-3.5" /> Reactivate
        </Button>
      )}

      <div className="relative">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen(o => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`More actions for ${salon.name}`}
          className="gap-1"
        >
          More <ChevronDown className="w-3 h-3" />
        </Button>

        {open && (
          <div
            role="menu"
            aria-label={`Override actions for ${salon.name}`}
            className="absolute right-0 mt-1 w-52 rounded-xl bg-surface-secondary border border-white/[0.08] shadow-xl shadow-black/40 z-20 overflow-hidden animate-slide-up"
          >
            <button
              role="menuitem"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-dark-100 hover:bg-white/[0.05] hover:text-white transition-colors"
              onClick={() => { setOpen(false); onGrantSub() }}
              id={`grant-sub-btn-${salon.id}`}
            >
              <CreditCard className="w-4 h-4 text-brand-400 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-white">Grant Subscription</p>
                <p className="text-xs text-dark-300 mt-0.5">Bypass billing &amp; assign plan</p>
              </div>
            </button>
            <div className="border-t border-white/[0.06]" />
            <button
              role="menuitem"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-dark-100 hover:bg-white/[0.05] hover:text-white transition-colors"
              onClick={() => { setOpen(false); onUpdateTokens() }}
              id={`update-tokens-btn-${salon.id}`}
            >
              <Coins className="w-4 h-4 text-amber-400 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-white">Update Token Limit</p>
                <p className="text-xs text-dark-300 mt-0.5">Override daily queue capacity</p>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
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

  // Override modal state
  const [grantSubSalon, setGrantSubSalon]         = useState(null) // salon object
  const [updateTokensSalon, setUpdateTokensSalon] = useState(null) // salon object

  /** Fire the confirmed status action */
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
          <p className="text-xs text-dark-200 mb-3">
            {hasFilters
              ? `Showing ${filtered.length} of ${salons.length} salons`
              : `${salons.length} salon${salons.length !== 1 ? 's' : ''} registered`
            }
          </p>

          <Card className="p-0 overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm min-w-[720px]">
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
                        <div className="flex justify-end">
                          <SalonActionsMenu
                            salon={s}
                            actionLoading={actionLoading}
                            onApprove={() => setConfirmAction({ id: s.id, name: s.name, action: 'approve' })}
                            onSuspend={() => setConfirmAction({ id: s.id, name: s.name, action: 'suspend' })}
                            onGrantSub={() => setGrantSubSalon(s)}
                            onUpdateTokens={() => setUpdateTokensSalon(s)}
                          />
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

      {/* Confirmation dialog — approve / suspend */}
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

      {/* Grant Subscription modal */}
      <GrantSubscriptionModal
        open={!!grantSubSalon}
        onClose={() => setGrantSubSalon(null)}
        salon={grantSubSalon}
        onSuccess={refetch}
      />

      {/* Update Token Limit modal */}
      <UpdateTokenLimitModal
        open={!!updateTokensSalon}
        onClose={() => setUpdateTokensSalon(null)}
        salon={updateTokensSalon}
        onSuccess={refetch}
      />
    </div>
  )
}
