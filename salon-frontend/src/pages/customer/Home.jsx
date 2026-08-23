import { Link } from 'react-router-dom'
import { Scissors, MapPin, Clock, Star, ArrowRight, Ticket, Shield, Zap } from 'lucide-react'
import { useSalons, useMyToken } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import { StarRating, Skeleton, TokenBadge, Card } from '../../components/ui'

const FEATURES = [
  { icon: Ticket, title: 'Digital Token', desc: 'Get a token from anywhere. No need to queue physically.', color: 'text-brand-400 bg-brand-500/10' },
  { icon: Zap, title: 'Live Queue', desc: 'Watch your position update in real-time.', color: 'text-amber-400 bg-amber-500/10' },
  { icon: Clock, title: 'Smart ETA', desc: 'Accurate wait time estimates based on active workers.', color: 'text-blue-400 bg-blue-500/10' },
  { icon: Star, title: 'Rate Your Barber', desc: 'Leave honest ratings after your haircut.', color: 'text-purple-400 bg-purple-500/10' },
]

export default function Home() {
  const { data: salonsData, loading: salonsLoading } = useSalons({ limit: 3, status: 'active' })
  const { user } = useAuth()
  const { data: myToken } = useMyToken(Boolean(user))

  const featuredSalons = Array.isArray(salonsData) ? salonsData : []
  const hasActiveToken = myToken && ['waiting', 'called', 'serving'].includes(myToken.status)

  return (
    <div className="flex flex-col gap-12 sm:gap-20">
      
      {/* HERO SECTION */}
      <section className="relative w-full pt-16 pb-20 sm:pt-24 sm:pb-32 overflow-hidden border-b border-white/5 bg-surface-secondary/30 rounded-3xl">
        {/* Animated grid background */}
        <div className="absolute inset-0 bg-grid opacity-60 pointer-events-none" />
        {/* Radial gradient over grid */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-500/20 via-surface-secondary/60 to-transparent pointer-events-none" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-surface-primary/80 to-transparent pointer-events-none" />
        
        <div className="relative z-10 container-app flex flex-col items-center text-center">
          
          {hasActiveToken ? (
            /* ACTIVE TOKEN HERO */
            <div className="w-full max-w-xl flex flex-col items-center animate-token-appear">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-bold uppercase tracking-widest mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                Live Status
              </div>
              <h1 className="text-sm font-semibold text-dark-100 uppercase tracking-widest mb-2">Your Token</h1>
              <div className="text-[6rem] sm:text-[8rem] font-display font-black text-white leading-none tracking-tighter mb-4 drop-shadow-2xl shadow-brand-500/20">
                #{myToken.token_number}
              </div>
              <TokenBadge status={myToken.status} />
              
              <div className="grid grid-cols-2 gap-4 w-full mt-10">
                <Card className="p-4 text-center">
                  <p className="text-xs font-medium text-dark-200 uppercase tracking-wider mb-1">Queue Ahead</p>
                  <p className="text-3xl font-display font-bold text-white">
                    {myToken.position ? Math.max(0, myToken.position - 1) : 0}
                  </p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-xs font-medium text-dark-200 uppercase tracking-wider mb-1">Est. Wait</p>
                  <p className="text-3xl font-display font-bold text-brand-400">
                    {myToken.estimated_wait_mins ? `${myToken.estimated_wait_mins}m` : '--'}
                  </p>
                </Card>
              </div>
              <Link to="/my-token" className="btn-primary w-full max-w-sm justify-center py-4 mt-6 text-base shadow-glow-gold hover:-translate-y-1 transition-transform group">
                View Live Queue <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          ) : (
            /* DEFAULT HERO */
            <div className="w-full max-w-3xl flex flex-col items-center animate-slide-up">
              {/* Trust badge */}
              <div className="inline-flex max-w-full items-center justify-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-bold uppercase tracking-widest text-center leading-relaxed mb-8">
                <Zap className="w-3.5 h-3.5" />
                Live Queue Tracking · No More Physical Waiting
              </div>

              <h1 className="text-3xl sm:text-6xl md:text-7xl font-display font-black text-white leading-[1.05] tracking-tight mb-6">
                MEN'S GROOMING,<br />
                <span className="text-brand-500 inline-block relative">
                  WITHOUT THE WAIT.
                  <span className="absolute -bottom-2 left-0 w-full h-2 bg-brand-500/20 blur-sm rounded-full" />
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-dark-100 max-w-xl mx-auto leading-relaxed mb-10">
                Get your digital token. Track your queue live. Come exactly when your turn is near.
              </p>
              <div className="flex flex-col w-full sm:w-auto sm:flex-row gap-4 justify-center mb-12">
                <Link to="/salons" className="btn-primary w-full sm:w-auto px-8 py-4 text-base shadow-glow-gold justify-center">
                  Get Token <ArrowRight className="w-5 h-5 ml-1" />
                </Link>
                <Link to="/salons" className="btn-secondary w-full sm:w-auto px-8 py-4 text-base justify-center">
                  <MapPin className="w-5 h-5 mr-2" /> Find Nearby Salons
                </Link>
              </div>

              {/* Social proof stats */}
              <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 pt-8 border-t border-white/[0.06] w-full">
                {[
                  { value: '1,200+', label: 'Customers served' },
                  { value: '50+',    label: 'Partner salons' },
                  { value: '4.8★',  label: 'Average rating' },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className="text-2xl font-display font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-dark-200 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FEATURED SALONS */}
      <section className="container-app">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-1">Live Salons</h2>
            <p className="text-dark-100 text-sm">Join the queue at top-rated barbers near you.</p>
          </div>
          <Link to="/salons" className="btn-ghost hidden sm:flex">
            View All <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {salonsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)
          ) : featuredSalons.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface-tertiary border border-white/10 flex items-center justify-center mb-4">
                <Scissors className="w-7 h-7 text-dark-300" />
              </div>
              <p className="text-dark-100 text-sm font-medium">No live salons available right now</p>
              <p className="text-dark-200 text-xs mt-1">Check back soon or browse all salons</p>
            </div>
          ) : (
            featuredSalons.map(salon => <SalonCard key={salon.id} salon={salon} />)
          )}
        </div>
        
        <Link to="/salons" className="btn-secondary w-full justify-center mt-6 sm:hidden">
          View All Salons
        </Link>
      </section>

      {/* HOW IT WORKS */}
      <section className="container-app mb-12">
        <Card className="bg-surface-secondary/50 border-white/5 p-8 sm:p-12 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-72 h-72 bg-brand-500/5 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />
          <div className="text-center mb-10 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-bold uppercase tracking-widest mb-4">
              <Shield className="w-3.5 h-3.5" /> Why QueueCut?
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">Smart Grooming in 3 Steps</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {FEATURES.map((f, idx) => (
              <div key={f.title} className="flex flex-col items-center text-center group">
                <div className="relative mb-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${f.color} shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                    <f.icon className="w-6 h-6" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-surface-tertiary border border-white/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-dark-200">{idx + 1}</span>
                  </div>
                </div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-dark-100 leading-relaxed max-w-[200px]">{f.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

    </div>
  )
}

function SalonCard({ salon }) {
  const isOpen = () => {
    if (salon.status !== 'active') return false
    const now = new Date()
    const [oh, om] = (salon.opening_time ?? '09:00').split(':').map(Number)
    const [ch, cm] = (salon.closing_time ?? '21:00').split(':').map(Number)
    const mins = now.getHours() * 60 + now.getMinutes()
    return mins >= oh * 60 + om && mins < ch * 60 + cm
  }
  const open = isOpen()

  return (
    <Card hover className="group flex flex-col h-full overflow-hidden p-0">
      <div className="h-40 bg-surface-tertiary relative overflow-hidden">
        {salon.cover_image_url ? (
          <img src={salon.cover_image_url} alt={salon.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-tertiary">
            <Scissors className="w-10 h-10 text-dark-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end">
          <div>
            <h3 className="font-display font-bold text-lg text-white leading-tight mb-1">{salon.name}</h3>
            <div className="flex items-center gap-1.5 text-xs text-dark-100">
              <MapPin className="w-3 h-3" /> {salon.city}
            </div>
          </div>
          <StarRating rating={salon.avg_rating ?? 4.5} />
        </div>
        <div className="absolute top-3 right-3">
           <span className={open ? 'badge bg-success/20 text-success border border-success/20 backdrop-blur-md' : 'badge bg-dark-400/50 text-white backdrop-blur-md'}>
             {open ? 'Open' : 'Closed'}
           </span>
        </div>
      </div>
      
      <div className="p-4 flex-1 flex flex-col">
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-surface-primary/50 border border-white/5 rounded-xl p-3 text-center">
            <p className="text-[10px] font-semibold text-dark-200 uppercase tracking-wider mb-1">Queue</p>
            <p className="font-display font-bold text-white text-xl leading-none">{salon.queue_count ?? 0}</p>
          </div>
          <div className="bg-brand-500/5 border border-brand-500/10 rounded-xl p-3 text-center">
            <p className="text-[10px] font-semibold text-dark-200 uppercase tracking-wider mb-1">Est. Wait</p>
            <p className="font-display font-bold text-brand-400 text-xl leading-none">
              {salon.queue_count ? `${salon.queue_count * (salon.avg_service_minutes ?? 30)}m` : '0m'}
            </p>
          </div>
        </div>
        <Link to={`/salons/${salon.id}`} className="btn-secondary w-full justify-center mt-auto">
          Get Token
        </Link>
      </div>
    </Card>
  )
}

