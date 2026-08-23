import { useState, useCallback } from 'react'
import {
  CreditCard, Check, Zap, AlertTriangle, Info, RefreshCw,
  CalendarDays, ShieldCheck, TrendingUp, Clock
} from 'lucide-react'
import { useSubscriptionPlans, useMySubscription } from '../../hooks/useApi'
import { PageHeader, Button, Card, Skeleton, ErrorState, Modal } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import api from '../../lib/api'

// ─── Razorpay SDK loader (lazy — loaded only when user initiates checkout) ────
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  trialing:  { color: 'text-blue-400  bg-blue-500/15  border-blue-500/30',  label: 'Trial Active' },
  active:    { color: 'text-green-400 bg-green-500/15 border-green-500/30', label: 'Active' },
  past_due:  { color: 'text-amber-400 bg-amber-500/15 border-amber-500/30', label: 'Past Due' },
  cancelled: { color: 'text-dark-200  bg-white/5      border-white/10',      label: 'Cancelled' },
  expired:   { color: 'text-red-400   bg-red-500/15   border-red-500/30',   label: 'Expired' },
  suspended: { color: 'text-red-400   bg-red-500/15   border-red-500/30',   label: 'Suspended' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { color: 'text-dark-200 bg-white/5 border-white/10', label: status }
  return (
    <span
      className={`badge border ${cfg.color}`}
      aria-label={`Subscription status: ${cfg.label}`}
    >
      {cfg.label}
    </span>
  )
}

// ─── Skeletons ────────────────────────────────────────────────────────────────
function PlansSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[320px]" />
      ))}
    </div>
  )
}

function SubscriptionSkeleton() {
  return <Skeleton className="h-[160px] mb-8" aria-hidden="true" />
}

// ─── Current subscription card ────────────────────────────────────────────────
function CurrentSubscriptionCard({ sub, plans, onRefetch }) {
  const plan = plans?.find(p => p.id === sub.plan_id)

  const formatDate = (dt) =>
    dt ? new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const banners = {
    trialing: { type: 'info',    icon: Info,          text: `Trial active — ends ${formatDate(sub.trial_ends_at)}` },
    past_due: { type: 'warning', icon: AlertTriangle,  text: 'Payment overdue. Please update your payment method via Razorpay.' },
    expired:  { type: 'error',   icon: AlertTriangle,  text: 'Your plan has expired. Choose a plan below to continue.' },
    suspended:{ type: 'error',   icon: AlertTriangle,  text: 'Account suspended. Contact support or re-subscribe below.' },
    cancelled:{ type: 'warning', icon: Info,           text: `Subscription cancelled${sub.cancelled_at ? ' on ' + formatDate(sub.cancelled_at) : ''}. Re-subscribe below.` },
  }
  const banner = banners[sub.status]
  const bannerColors = {
    info:    'border-blue-500/20  bg-blue-500/[0.04]  text-blue-400',
    warning: 'border-amber-500/20 bg-amber-500/[0.04] text-amber-400',
    error:   'border-red-500/20   bg-red-500/[0.04]   text-red-400',
  }

  return (
    <div className="mb-8">
      {banner && (
        <div className={`card p-4 mb-4 border flex items-start gap-3 ${bannerColors[banner.type]}`}>
          <banner.icon className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm">{banner.text}</p>
        </div>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-400" aria-hidden="true" />
            Current Subscription
          </h2>
          <div className="flex items-center gap-2">
            {/* aria-live region — announces status updates */}
            <div aria-live="polite" aria-atomic="true">
              <StatusBadge status={sub.status} />
            </div>
            <Button variant="icon" size="sm" onClick={onRefetch} aria-label="Refresh subscription status">
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-dark-200 uppercase tracking-wider mb-1">Plan</p>
            <p className="text-sm font-semibold text-white">{plan?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-dark-200 uppercase tracking-wider mb-1">Billing</p>
            <p className="text-sm font-semibold text-white capitalize">{plan?.billing_interval ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-dark-200 uppercase tracking-wider mb-1 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" aria-hidden="true" />Period End
            </p>
            <p className="text-sm font-semibold text-white">{formatDate(sub.current_period_end)}</p>
          </div>
          <div>
            <p className="text-xs text-dark-200 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" aria-hidden="true" />Started
            </p>
            <p className="text-sm font-semibold text-white">{formatDate(sub.started_at)}</p>
          </div>
        </div>

        {sub.cancel_at_period_end && (
          <p className="mt-4 text-xs text-amber-400 border border-amber-500/20 bg-amber-500/5 rounded-xl px-3 py-2">
            ⚠ Scheduled to cancel at period end ({formatDate(sub.current_period_end)})
          </p>
        )}
      </Card>
    </div>
  )
}

// ─── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({ plan, isCurrent, canUpgrade, onChoose, checkingOut }) {
  const isPopular = plan.sort_order === 20
  const isFree = plan.price === 0

  // Upgrade allowed: not current, not past_due, not suspended
  const upgradeAllowed = !isCurrent && canUpgrade

  return (
    <article
      className={`card p-5 flex flex-col relative transition-all duration-200 ${
        isCurrent ? 'border-brand-500/40 shadow-glow-sm' : 'card-hover'
      }`}
      aria-label={`${plan.name} — ${isFree ? 'Free' : `₹${plan.price} per ${plan.billing_interval}`}`}
      aria-current={isCurrent ? 'true' : undefined}
    >
      {isPopular && !isCurrent && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge border text-xs bg-brand-500/20 text-brand-400 border-brand-500/30">
          Popular
        </span>
      )}
      {isCurrent && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge border text-xs bg-green-500/20 text-green-400 border-green-500/30">
          Current Plan
        </span>
      )}

      {/* Price & name */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
        {plan.description && (
          <p className="text-xs text-dark-200 mt-0.5 leading-relaxed">{plan.description}</p>
        )}
        <div className="flex items-baseline gap-1 mt-2">
          <span className="text-2xl font-bold text-white">
            {isFree ? 'Free' : `₹${plan.price.toLocaleString('en-IN')}`}
          </span>
          {!isFree && (
            <span className="text-dark-200 text-sm">/{plan.billing_interval}</span>
          )}
        </div>
        {plan.trial_days > 0 && (
          <p className="text-xs text-brand-400 mt-1">{plan.trial_days}-day free trial</p>
        )}
      </div>

      {/* Features */}
      <ul className="flex flex-col gap-2 mb-5 flex-1" aria-label={`${plan.name} plan features`}>
        {plan.features?.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-dark-100">
            <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            {f}
          </li>
        ))}
        {plan.max_workers && (
          <li className="flex items-start gap-2 text-sm text-dark-100">
            <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            Up to {plan.max_workers} Barber{plan.max_workers > 1 ? 's' : ''}
          </li>
        )}
        {plan.max_services && (
          <li className="flex items-start gap-2 text-sm text-dark-100">
            <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            Up to {plan.max_services} Services
          </li>
        )}
        {plan.max_monthly_tokens && (
          <li className="flex items-start gap-2 text-sm text-dark-100">
            <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            {plan.max_monthly_tokens.toLocaleString('en-IN')} tokens/month
          </li>
        )}
      </ul>

      {/* CTA */}
      {isCurrent ? (
        <Button variant="secondary" fullWidth className="justify-center text-sm" disabled aria-label="You are on this plan">
          <Check className="w-4 h-4" aria-hidden="true" /> Current Plan
        </Button>
      ) : isFree ? (
        <Button variant="ghost" fullWidth className="justify-center text-sm" disabled>
          Free Forever
        </Button>
      ) : (
        <Button
          variant="primary"
          fullWidth
          className="justify-center text-sm"
          disabled={!upgradeAllowed || checkingOut}
          loading={checkingOut}
          onClick={() => onChoose(plan)}
          aria-label={`Choose ${plan.name} plan — ₹${plan.price} per ${plan.billing_interval}`}
        >
          <TrendingUp className="w-4 h-4" aria-hidden="true" />
          {upgradeAllowed ? 'Choose Plan' : 'Unavailable'}
        </Button>
      )}
    </article>
  )
}

// ─── Confirm checkout modal ────────────────────────────────────────────────────
function ConfirmCheckoutModal({ open, plan, onConfirm, onClose, loading }) {
  if (!plan) return null
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm Plan Selection"
      titleId="checkout-confirm-title"
      size="sm"
    >
      <div className="space-y-4">
        <div className="card-elevated p-4 rounded-xl text-center">
          <p className="text-white font-bold text-lg">{plan.name}</p>
          <p className="text-3xl font-bold text-brand-400 mt-1">
            ₹{plan.price.toLocaleString('en-IN')}
            <span className="text-base font-normal text-dark-200">/{plan.billing_interval}</span>
          </p>
          {plan.trial_days > 0 && (
            <p className="text-xs text-blue-400 mt-1">Includes {plan.trial_days}-day free trial</p>
          )}
        </div>

        <div className="border border-amber-500/20 bg-amber-500/[0.04] rounded-xl p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-dark-100 leading-relaxed">
            You will be redirected to Razorpay to complete payment. Your plan activates automatically once payment is confirmed.
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="px-5">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={loading}
            className="px-5"
            aria-label={`Confirm subscription to ${plan.name}`}
          >
            <CreditCard className="w-4 h-4" aria-hidden="true" />
            Proceed to Payment
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main page component ──────────────────────────────────────────────────────
export default function Subscription() {
  const toast = useToast()

  // Fetch plans (public) and current subscription (404 = no plan yet)
  const { data: plans, loading: plansLoading, error: plansError, refetch: refetchPlans } = useSubscriptionPlans()
  const { data: sub, loading: subLoading, error: subError, refetch: refetchSub } = useMySubscription()

  // Local state
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [modalOpen, setModalOpen]       = useState(false)
  const [checkingOut, setCheckingOut]   = useState(false)

  // Whether sub is simply absent (404) vs a real fetch error
  const noSub = !sub && subError?.includes('404')
  const subFetchError = !sub && subError && !noSub

  // Determine if upgrades are allowed based on current status
  const canUpgrade = !sub || ['active', 'trialing', 'cancelled', 'expired', 'suspended'].includes(sub?.status)

  const handleChoose = (plan) => {
    setSelectedPlan(plan)
    setModalOpen(true)
  }

  const handleCheckout = useCallback(async () => {
    if (!selectedPlan) return
    setCheckingOut(true)

    try {
      // 1. Load Razorpay SDK on demand
      const sdkLoaded = await loadRazorpayScript()
      if (!sdkLoaded) {
        toast.error('Payment system unavailable. Please try again.')
        setCheckingOut(false)
        return
      }

      // 2. Create checkout session — send ONLY plan_id
      const res = await api.post('/api/billing/checkout', { plan_id: selectedPlan.id })
      const { provider_order_id, razorpay_key_id, currency } = res.data

      // 3. Close modal, open Razorpay
      setModalOpen(false)

      const options = {
        key: razorpay_key_id,              // Key ID from backend — NOT a secret
        subscription_id: provider_order_id, // Razorpay Subscription ID
        name: 'QueueCut',
        description: selectedPlan.name,
        currency,
        handler: function () {
          // SUCCESS — DO NOT activate subscription here
          // Activation happens via webhook → backend only
          toast.info(
            'Payment received! Your plan will activate shortly.',
            'Payment Initiated'
          )
          // Refetch after delay to allow webhook to process
          setTimeout(() => refetchSub(), 5000)
        },
        modal: {
          ondismiss: function () {
            setCheckingOut(false)
            toast.warning('Payment was cancelled.')
          },
        },
        theme: { color: '#d4821e' }, // brand-500
      }

      new window.Razorpay(options).open()
    } catch (err) {
      const msg = err.message || 'Unable to start subscription checkout.'
      toast.error(msg)
      setCheckingOut(false)
    }
  }, [selectedPlan, toast, refetchSub])

  const handleModalClose = () => {
    if (checkingOut) return
    setModalOpen(false)
    setSelectedPlan(null)
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Subscription & Billing"
        subtitle="Manage your plan and payment details."
      />

      {/* ── Current Subscription ── */}
      <section aria-label="Current subscription">
        {subLoading ? (
          <SubscriptionSkeleton />
        ) : subFetchError ? (
          <Card className="p-6 mb-8">
            <ErrorState
              title="Failed to load subscription"
              message={subError}
              onRetry={refetchSub}
            />
          </Card>
        ) : sub ? (
          <CurrentSubscriptionCard sub={sub} plans={plans} onRefetch={refetchSub} />
        ) : noSub ? (
          <div className="card p-5 mb-8 border border-blue-500/20 bg-blue-500/[0.04]">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-blue-400 mb-0.5">No Active Plan</p>
                <p className="text-xs text-dark-100 leading-relaxed">
                  Choose a plan below to unlock the full QueueCut experience.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Plans Grid ── */}
      <section aria-label="Available subscription plans" aria-busy={plansLoading}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand-400" aria-hidden="true" />
            Available Plans
          </h2>
          <Button variant="icon" size="sm" onClick={refetchPlans} aria-label="Refresh plans" disabled={plansLoading}>
            <RefreshCw className={`w-4 h-4 ${plansLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        </div>

        {plansLoading ? (
          <div role="status" aria-label="Loading plans">
            <PlansSkeleton />
          </div>
        ) : plansError ? (
          <ErrorState
            title="Failed to load plans"
            message={plansError}
            onRetry={refetchPlans}
          />
        ) : !plans?.length ? (
          <Card className="p-10 text-center">
            <p className="text-dark-200">No active plans available at this time.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={sub?.plan_id === plan.id}
                canUpgrade={canUpgrade}
                onChoose={handleChoose}
                checkingOut={checkingOut && selectedPlan?.id === plan.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Confirm Checkout Modal ── */}
      <ConfirmCheckoutModal
        open={modalOpen}
        plan={selectedPlan}
        onConfirm={handleCheckout}
        onClose={handleModalClose}
        loading={checkingOut}
      />
    </div>
  )
}
