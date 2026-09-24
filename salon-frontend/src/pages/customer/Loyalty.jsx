import { useState } from 'react'
import { Gift, Star, Clock, Trophy, ArrowRight, Loader2, Tag } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const REWARDS = [
  { points: 100, title: '₹20 Off',        desc: 'Save ₹20 on any service', color: 'text-brand-400' },
  { points: 250, title: 'Free Beard Trim', desc: 'Valid at any participating salon', color: 'text-amber-400' },
  { points: 500, title: 'Free Haircut',    desc: 'The ultimate grooming reward', color: 'text-purple-400' },
]

export default function Loyalty() {
  const { profile, refetchProfile } = useAuth()
  const points = profile?.loyalty_points ?? 0
  const queryClient = useQueryClient()
  
  const [redeeming, setRedeeming] = useState(null)

  const { data: rewardsData, isLoading: loadingRewards } = useQuery({
    queryKey: ['/api/loyalty/rewards'],
    queryFn: async () => {
      const { data } = await api.get('/api/loyalty/rewards')
      return data.rewards || []
    }
  })

  const redeemMutation = useMutation({
    mutationFn: async (reward) => {
      const { data } = await api.post('/api/loyalty/redeem', reward)
      return data
    },
    onSuccess: () => {
      toast.success('Reward redeemed successfully!')
      refetchProfile()
      queryClient.invalidateQueries(['/api/loyalty/rewards'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to redeem reward')
    },
    onSettled: () => {
      setRedeeming(null)
    }
  })

  const handleRedeem = (reward) => {
    if (confirm(`Redeem "${reward.title}" for ${reward.points} points?`)) {
      setRedeeming(reward.title)
      redeemMutation.mutate({ title: reward.title, points: reward.points })
    }
  }

  const activeRewards = rewardsData?.filter(r => r.status === 'active') || []

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

      {/* Active Rewards (Redeemed but unused) */}
      {activeRewards.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-white mb-4">My Active Rewards</h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {activeRewards.map((reward) => (
              <div key={reward.id} className="card p-5 border border-brand-500/30 bg-brand-500/5 relative overflow-hidden flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                  <Tag className="w-6 h-6 text-brand-400" />
                </div>
                <div>
                  <p className="font-bold text-white">{reward.reward_title}</p>
                  <p className="text-xs text-dark-100">Show this to the barber to use it</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Rewards available to redeem */}
      <h2 className="text-lg font-bold text-white mb-4">Redeem Points</h2>
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {REWARDS.map((r, i) => {
          const isRedeeming = redeeming === r.title
          const canRedeem = points >= r.points
          return (
            <div key={i} className={`card p-5 relative overflow-hidden ${canRedeem ? 'border-brand-500/30' : 'opacity-60'}`}>
              {canRedeem && (
                <div className="absolute -top-6 -right-6 w-16 h-16 bg-brand-500/20 rounded-full blur-xl pointer-events-none" />
              )}
              <Gift className={`w-6 h-6 mb-3 ${r.color}`} />
              <p className="font-bold text-white mb-1">{r.title}</p>
              <p className="text-xs text-dark-100 mb-4">{r.desc}</p>
              <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-3">
                <span className="font-bold text-sm text-white">{r.points} pts</span>
                {canRedeem ? (
                  <button 
                    onClick={() => handleRedeem(r)}
                    disabled={isRedeeming || redeemMutation.isPending}
                    className="btn-primary text-xs px-3 py-1.5 min-h-0 h-auto rounded-lg flex items-center gap-2"
                  >
                    {isRedeeming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Redeem'}
                  </button>
                ) : (
                  <span className="text-xs text-dark-300">{r.points - points} more</span>
                )}
              </div>
            </div>
          )
        })}
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
