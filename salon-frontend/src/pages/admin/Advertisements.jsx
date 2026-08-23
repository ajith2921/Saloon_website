import { Megaphone, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

/**
 * Platform Advertisements are managed by Super Admins, not individual salon owners.
 * This page simply informs the salon owner and links them to the customer-facing view.
 */
export default function Advertisements() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2">Advertisements</h1>
      <p className="text-dark-100 text-sm mb-8">Platform-wide promotions and banners</p>

      <div className="card p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-tertiary border border-white/10 flex items-center justify-center mx-auto mb-4">
          <Megaphone className="w-8 h-8 text-brand-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Managed by Platform Team</h2>
        <p className="text-dark-100 text-sm max-w-md mx-auto leading-relaxed mb-6">
          Platform advertisements are managed centrally by the QueueCut super admin team.
          These ads are shown to all customers across all salons to promote events, offers, and features.
        </p>
        <p className="text-dark-200 text-xs mb-6">
          Want your salon promoted? Contact <span className="text-brand-400">support@queuecut.com</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/admin" className="btn-secondary">
            Back to Dashboard
          </Link>
          <Link to="/admin/settings" className="btn-primary">
            Update Salon Profile <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
