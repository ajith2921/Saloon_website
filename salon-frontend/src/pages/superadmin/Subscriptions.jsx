import { CreditCard, Check, Zap } from 'lucide-react'
import { PageHeader, Button, ErrorState, Skeleton } from '../../components/ui'
import { useFetch } from '../../hooks/useApi'

function PlansSkeleton() {
  return (
    <div className="grid sm:grid-cols-3 gap-4 mb-8">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[300px]" />
      ))}
    </div>
  )
}

function SubscriptionsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[80px]" />
      ))}
    </div>
  )
}

export default function Subscriptions() {
  const { data: plans, loading: plansLoading, error: plansError, refetch: refetchPlans } = useFetch('/api/subscriptions/plans')
  const { data: subscriptions, loading: subsLoading, error: subsError, refetch: refetchSubs } = useFetch('/api/subscriptions/all')

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Subscriptions & Billing"
        subtitle="Manage platform subscription plans. Automated payments are under development."
      />

      {/* Coming soon notice */}
      <div className="card p-5 mb-8 border border-amber-500/20 bg-amber-500/[0.04]">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-amber-400 mb-1">Billing Automation Phase K3.2</p>
            <p className="text-xs text-dark-100 leading-relaxed">
              Database and backend foundation is complete. Payment gateway integration (Stripe/Razorpay) is pending Phase K3.3.
              For now, manual database assignment is required to change a salon&apos;s active subscription.
            </p>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-white">Available Plans</h2>
      </div>

      {plansLoading ? (
        <PlansSkeleton />
      ) : plansError ? (
        <ErrorState title="Failed to load plans" message={plansError} onRetry={refetchPlans} className="mb-8 card p-6" />
      ) : plans?.length === 0 ? (
        <div className="card p-10 text-center mb-8">
          <p className="text-dark-200">No active plans available.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {plans?.map(plan => (
            <div key={plan.id} className="card p-5 border border-white/10 flex flex-col relative">
              {plan.sort_order === 20 && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge border text-xs bg-brand-500/20 text-brand-400 border-brand-500/30">
                  Popular
                </span>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="flex items-baseline gap-0.5 mt-1">
                  <span className="text-2xl font-bold text-white">
                    {plan.price === 0 ? 'Free' : `${plan.currency} ${plan.price}`}
                  </span>
                  <span className="text-dark-200 text-sm">/{plan.billing_interval}</span>
                </div>
              </div>

              <ul className="flex flex-col gap-2 mb-5 flex-1" aria-label={`${plan.name} features`}>
                {plan.features?.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-dark-100">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    {f}
                  </li>
                ))}
                
                {plan.max_workers && (
                  <li className="flex items-start gap-2 text-sm text-dark-100">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    Up to {plan.max_workers} Barbers
                  </li>
                )}
                {plan.max_services && (
                  <li className="flex items-start gap-2 text-sm text-dark-100">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    Up to {plan.max_services} Services
                  </li>
                )}
              </ul>

              <Button
                variant="secondary"
                fullWidth
                className="justify-center text-sm"
                disabled
                aria-label={`Assign ${plan.name} plan`}
              >
                Assign Plan (DB Only)
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Active subscriptions */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">All Subscriptions</h2>
          <Button variant="secondary" size="sm" onClick={refetchSubs} disabled={subsLoading}>
            Refresh
          </Button>
        </div>
        
        {subsLoading ? (
          <SubscriptionsSkeleton />
        ) : subsError ? (
          <ErrorState title="Failed to load subscriptions" message={subsError} onRetry={refetchSubs} />
        ) : subscriptions?.length === 0 ? (
           <div className="flex flex-col items-center gap-3 py-10 text-center">
             <CreditCard className="w-10 h-10 text-dark-300" aria-hidden="true" />
             <p className="text-dark-200 text-sm">No active subscriptions found.</p>
             <p className="text-xs text-dark-300 max-w-sm leading-relaxed">
               Subscriptions must currently be assigned via the database.
             </p>
           </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <caption className="sr-only">List of all salon subscriptions</caption>
              <thead className="text-xs text-dark-200 uppercase bg-dark-800/50">
                <tr>
                  <th scope="col" className="px-4 py-3 rounded-l-lg font-medium">Salon ID</th>
                  <th scope="col" className="px-4 py-3 font-medium">Plan ID</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Period End</th>
                  <th scope="col" className="px-4 py-3 rounded-r-lg font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map(sub => (
                  <tr key={sub.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-white">{sub.salon_id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-dark-100">{sub.plan_id}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${sub.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-100'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-dark-100">
                      {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                    </td>
                    <td className="px-4 py-3 text-dark-200">
                      {new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
