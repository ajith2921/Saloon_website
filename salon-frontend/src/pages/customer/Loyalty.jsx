import { Gift, Star, Clock, Trophy, ArrowRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'

const REWARDS = [
  { points: 100, title: '₹20 Off',        desc: 'Save ₹20 on any service', color: 'text-brand-400' },
  { points: 250, title: 'Free Beard Trim', desc: 'Valid at any participating salon', color: 'text-amber-400' },
  { points: 500, title: 'Free Haircut',    desc: 'The ultimate grooming reward', color: 'text-purple-400' },
]

export default function Loyalty() {
  const { profile } = useAuth()
  const points = profile?.loyalty_points ?? 0

  return (
    <div className="container-app max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Loyalty & Rewards</h1>

      {/* Balance card */}
      <div className="card p-6 mb-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-brand-500/20 to-transparent pointer-events-none" />
        <div className="w-20 h-20 rounded-full bg-brand-500/20 border-4 border-brand-500/30 flex items-center justify-center mx-auto mb-4 relative z-10 shadow-glow-sm">
          <Star className="w-10 h-10 text-brand-400 fill-brand-400" />
        </div>
        <p className="text-sm font-semibold text-brand-400 tracking-widest uppercase mb-1 relative z-10">
          Your Balance
        </p>
        <p className="text-5xl font-bold text-white mb-2 relative z-10">{points}</p>
        <p className="text-dark-100 text-sm relative z-10">Earn 10 points for every ₹100 spent</p>
      </div>

      {/* Rewards available */}
      <h2 className="text-lg font-bold text-white mb-4">Available Rewards</h2>
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {REWARDS.map((r, i) => (
          <div key={i} className={`card p-5 relative overflow-hidden ${points >= r.points ? 'border-brand-500/30' : 'opacity-60'}`}>
            {points >= r.points && (
              <div className="absolute -top-6 -right-6 w-16 h-16 bg-brand-500/20 rounded-full blur-xl pointer-events-none" />
            )}
            <Gift className={`w-6 h-6 mb-3 ${r.color}`} />
            <p className="font-bold text-white mb-1">{r.title}</p>
            <p className="text-xs text-dark-100 mb-4">{r.desc}</p>
            <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-3">
              <span className="font-bold text-sm text-white">{r.points} pts</span>
              {points >= r.points ? (
                <button className="btn-primary text-xs px-3 py-1.5 min-h-0 h-auto rounded-lg">Redeem</button>
              ) : (
                <span className="text-xs text-dark-300">{r.points - points} more</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* How to earn */}
      <h2 className="text-lg font-bold text-white mb-4">How to Earn</h2>
      <div className="card p-5 divide-y divide-white/[0.06]">
        <div className="flex items-center gap-4 py-4 first:pt-0">
          <div className="w-10 h-10 rounded-xl bg-surface-tertiary flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-dark-200" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Book a Token</p>
            <p className="text-xs text-dark-100">Earn points on every completed salon visit.</p>
          </div>
        </div>
        <div className="flex items-center gap-4 py-4 last:pb-0">
          <div className="w-10 h-10 rounded-xl bg-surface-tertiary flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Refer a Friend</p>
            <p className="text-xs text-dark-100">Earn 50 points when a friend joins with your code.</p>
          </div>
          <Link to="/profile" className="ml-auto btn-ghost text-xs whitespace-nowrap">
            View Code <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
