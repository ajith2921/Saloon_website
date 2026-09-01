import { useParams, Link } from 'react-router-dom'
import {
  Star, MapPin, Clock, Phone, Mail, Scissors,
  ArrowRight, ChevronLeft
} from 'lucide-react'
import { useSalon, useSalonServices, useSalonWorkers, useFetch } from '../../hooks/useApi'
import { useRealtimeQueue } from '../../hooks/useRealtime'
import { StarRating, EmptyState, Skeleton, Card, Button } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, shadowUrl })

export default function SalonDetails() {
  const { t } = useTranslation()
  const { salonId } = useParams()
  const { user } = useAuth()

  const { data: salon, loading: sLoading } = useSalon(salonId)
  const { data: servicesData }             = useSalonServices(salonId)
  const { data: workersData }              = useSalonWorkers(salonId)
  const { currentToken, waitingTokens }    = useRealtimeQueue(salonId)
  const { data: ratingsData }              = useFetch(salonId ? `/api/ratings/salon/${salonId}` : null)

  const services = servicesData?.services ?? []
  const workers  = workersData?.workers   ?? []
  const latestReviews = ratingsData?.ratings?.slice(0, 3) ?? []

  const now = new Date()
  const mins = now.getHours() * 60 + now.getMinutes()
  const isOpen = salon && (() => {
    const [oh, om] = (salon.opening_time ?? '09:00').split(':').map(Number)
    const [ch, cm] = (salon.closing_time ?? '21:00').split(':').map(Number)
    return salon.status === 'active' && mins >= oh * 60 + om && mins < ch * 60 + cm
  })()

  const waitMins = waitingTokens.length * (salon?.avg_service_minutes ?? 30)

  if (sLoading) return (
    <div className="min-h-screen">
      <Skeleton className="h-56 sm:h-72 w-full rounded-none" />
      <div className="container-app -mt-8 relative z-10 pb-16">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-5">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
  if (!salon) return (
    <div className="container-app py-12">
      <EmptyState icon={Scissors} title="Salon not found" description="This salon may have been removed or is not yet active." />
    </div>
  )

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": salon.name,
    "image": salon.cover_image_url || salon.logo_url || "",
    "telephone": salon.phone || "",
    "email": salon.email || "",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": salon.address || "",
      "addressLocality": salon.city || ""
    },
    "aggregateRating": salon.review_count > 0 ? {
      "@type": "AggregateRating",
      "ratingValue": salon.avg_rating,
      "reviewCount": salon.review_count
    } : undefined,
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "opens": salon.opening_time || "09:00",
      "closes": salon.closing_time || "21:00",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    }
  }

  const safeJsonLd = JSON.stringify(jsonLd)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd }} />
      {/* Cover */}
      <div className="h-56 sm:h-72 bg-surface-tertiary relative overflow-hidden">
        {salon.cover_image_url ? (
          <img src={salon.cover_image_url} alt={salon.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-card">
            <Scissors className="w-20 h-20 text-dark-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-primary/80 via-transparent to-transparent" />
        <div className="absolute top-4 left-4">
          <Link to="/salons" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-sm text-white text-sm hover:bg-black/60 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
        </div>
        <div className="absolute top-4 right-4">
          <span className={isOpen ? 'badge bg-success/20 text-success border border-success/20 backdrop-blur-md' : 'badge bg-dark-400/50 text-white backdrop-blur-md'}>
            {isOpen ? 'Open Now' : 'Closed'}
          </span>
        </div>
      </div>

      <div className="container-app -mt-8 relative z-10 pb-16">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Header card */}
            <Card className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-glow-sm flex-shrink-0">
                  {salon.logo_url ? (
                    <img src={salon.logo_url} alt={salon.name} className="w-16 h-16 rounded-2xl object-cover" />
                  ) : (
                    <Scissors className="w-8 h-8 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl sm:text-4xl font-display font-bold text-white leading-tight">{salon.name}</h1>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <StarRating rating={salon.avg_rating ?? 4.5} size="md" />
                    <span className="text-dark-200 text-sm">
                      ({salon.review_count ?? 0} reviews)
                    </span>
                  </div>
                  {salon.description && (
                    <p className="text-dark-100 text-sm mt-2 leading-relaxed">{salon.description}</p>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {salon.address && (
                  <div className="flex items-start gap-2 text-sm text-dark-100">
                    <MapPin className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                    <span>{salon.address}{salon.city ? `, ${salon.city}` : ''}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-dark-100">
                  <Clock className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span>
                    {salon.opening_time?.slice(0, 5) ?? '09:00'} – {salon.closing_time?.slice(0, 5) ?? '21:00'}
                  </span>
                </div>
                {salon.phone && (
                  <div className="flex items-center gap-2 text-sm text-dark-100">
                    <Phone className="w-4 h-4 text-brand-400 flex-shrink-0" />
                    <a href={`tel:${salon.phone}`} className="hover:text-white transition-colors">{salon.phone}</a>
                  </div>
                )}
                {salon.email && (
                  <div className="flex items-center gap-2 text-sm text-dark-100">
                    <Mail className="w-4 h-4 text-brand-400 flex-shrink-0" />
                    <a href={`mailto:${salon.email}`} className="hover:text-white transition-colors truncate">{salon.email}</a>
                  </div>
                )}
              </div>
            </Card>

            {/* Map Integration */}
            {salon.latitude && salon.longitude && (
              <Card className="p-2">
                <div className="rounded-xl overflow-hidden shadow-sm z-0 relative h-64 w-full">
                  <MapContainer 
                    center={[salon.latitude, salon.longitude]} 
                    zoom={15} 
                    scrollWheelZoom={false} 
                    className="h-full w-full"
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[salon.latitude, salon.longitude]}>
                      <Popup>{salon.name}</Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </Card>
            )}

            {/* Services */}
            {services.length > 0 && (
              <Card className="p-5">
                <h2 className="text-xl font-display font-bold text-white mb-4">Services & Prices</h2>
                <div className="flex flex-col divide-y divide-white/[0.06]">
                  {services.map((svc) => (
                    <div key={svc.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-medium text-white text-sm">{svc.name}</p>
                        <p className="text-xs text-dark-200 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> {svc.duration_minutes} min
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-brand-400">₹{svc.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Workers */}
            {workers.length > 0 && (
              <Card className="p-5">
                <h2 className="text-xl font-display font-bold text-white mb-4">Our Barbers</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {workers.filter((w) => w.status === 'active').map((worker) => (
                    <div key={worker.id} className="bg-surface-tertiary rounded-xl p-3 text-center">
                      <div className="w-14 h-14 rounded-xl mx-auto mb-2 bg-surface-elevated flex items-center justify-center overflow-hidden">
                        {worker.photo_url ? (
                          <img src={worker.photo_url} alt={worker.name} className="w-full h-full object-cover" />
                        ) : (
                          <Scissors className="w-6 h-6 text-dark-300" />
                        )}
                      </div>
                      <p className="font-semibold text-white text-sm">{worker.name}</p>
                      <p className="text-xs text-dark-200 mt-0.5">{worker.specialization}</p>
                      {worker.avg_rating && (
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span className="text-xs text-amber-400 font-medium">{worker.avg_rating}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Latest Reviews */}
            {latestReviews.length > 0 && (
              <Card className="p-5 mt-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-display font-bold text-white">{t('salonDetails.latest_reviews', 'Latest Reviews')}</h2>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400">
                    <Star className="w-4 h-4 fill-amber-400" />
                    <span className="font-bold text-sm">{salon.avg_rating}</span>
                  </div>
                </div>
                <div className="grid gap-4">
                  {latestReviews.map(r => (
                    <div key={r.id} className="bg-surface-tertiary rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center font-bold text-white text-xs">
                            {r.profiles?.full_name?.[0] ?? 'C'}
                          </div>
                          <p className="font-semibold text-white text-sm">{r.profiles?.full_name ?? 'Customer'}</p>
                        </div>
                        <StarRating rating={r.rating} size="sm" />
                      </div>
                      {r.review && (
                        <p className="text-dark-100 text-sm italic">"{r.review}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Queue sidebar */}
          <div className="flex flex-col gap-4">
            {/* Live queue card */}
            <Card className="p-6 border-2 border-brand-500/20 shadow-glow-sm bg-gradient-card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wider">{t('salonDetails.live_queue', 'Live Queue')}</h2>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 border border-success/20">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs font-bold text-success uppercase tracking-widest">Live</span>
                </div>
              </div>

              <div className="flex flex-col gap-4 mb-6">
                <div className="bg-surface-primary/60 border border-white/5 rounded-2xl p-4 text-center">
                  <p className="text-[10px] font-semibold text-dark-200 uppercase tracking-widest mb-1">{t('salonDetails.now_serving', 'Now Serving')}</p>
                  <p className="text-5xl font-display font-bold text-white leading-none">
                    {currentToken ? `#${currentToken.token_number}` : '—'}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-primary/60 border border-white/5 rounded-2xl p-4 text-center">
                    <p className="text-[10px] font-semibold text-dark-200 uppercase tracking-widest mb-1">{t('salonDetails.waiting', 'Waiting')}</p>
                    <p className="text-3xl font-display font-bold text-white leading-none">{waitingTokens.length}</p>
                  </div>
                  <div className="bg-brand-500/5 border border-brand-500/10 rounded-2xl p-4 text-center">
                    <p className="text-[10px] font-semibold text-dark-200 uppercase tracking-widest mb-1">{t('salonDetails.est_wait', 'Est. Wait')}</p>
                    <p className="text-3xl font-display font-bold text-brand-400 leading-none">
                      {waitMins === 0 ? '0m' : `~${waitMins}m`}
                    </p>
                  </div>
                </div>
              </div>

              {isOpen ? (
                <div className="flex flex-col gap-2">
                  <Link to={user ? `/salons/${salonId}/token` : '/login'} className="block w-full">
                    <Button fullWidth>{t('salonDetails.get_token', 'Get Token')} <ArrowRight className="w-4 h-4 ml-1" /></Button>
                  </Link>
                  <Link to={user ? `/salons/${salonId}/token?mode=book` : '/login'} className="block w-full">
                    <Button fullWidth variant="secondary" className="text-sm">
                      📅 {t('salonDetails.book_appointment', 'Book Appointment')}
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="bg-surface-tertiary rounded-xl p-3 text-center border border-white/5">
                  <p className="text-dark-100 text-sm font-medium">{t('salonDetails.salon_closed', 'Salon is currently closed')}</p>
                  <p className="text-xs text-dark-200 mt-0.5">
                    {t('salonDetails.opens_at', 'Opens at')} {salon.opening_time?.slice(0, 5) ?? '09:00'}
                  </p>
                  <Link to={user ? `/salons/${salonId}/token?mode=book` : '/login'} className="block w-full mt-3">
                    <Button fullWidth variant="secondary" className="text-sm">
                      📅 {t('salonDetails.book_for_later', 'Book for Later')}
                    </Button>
                  </Link>
                </div>
              )}
            </Card>

            {/* Quick stats */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-white mb-3">{t('salonDetails.quick_info', 'Quick Info')}</h3>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: t('salonDetails.max_daily_tokens', 'Max Daily Tokens'), value: salon.max_daily_tokens ?? 50 },
                  { label: t('salonDetails.avg_service_time', 'Avg Service Time'),  value: `${salon.avg_service_minutes ?? 30} min` },
                  { label: t('salonDetails.workers_available', 'Workers Available'), value: workers.filter((w) => w.status === 'active').length },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs text-dark-200">{item.label}</span>
                    <span className="text-sm font-semibold text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile Sticky CTA */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 p-4 bg-surface-secondary/90 backdrop-blur-xl border-t border-white/10 z-40 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs font-semibold text-dark-200 uppercase tracking-widest mb-0.5">{t('salonDetails.est_wait', 'Est. Wait')}</p>
            <p className="text-xl font-display font-bold text-brand-400 leading-none">
              {waitMins === 0 ? '0m' : `~${waitMins}m`}
            </p>
          </div>
          <div className="flex-1">
            {isOpen ? (
              <div className="flex gap-2">
                <Link to={user ? `/salons/${salonId}/token` : '/login'} className="flex-1">
                  <Button fullWidth className="py-3 shadow-glow-gold text-sm">{t('salonDetails.get_token', 'Get Token')}</Button>
                </Link>
                <Link to={user ? `/salons/${salonId}/token?mode=book` : '/login'} className="flex-1">
                  <Button fullWidth variant="secondary" className="py-3 text-sm">📅 Book</Button>
                </Link>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button fullWidth disabled variant="secondary" className="py-3 flex-1">{t('findSalons.closed', 'Closed')}</Button>
                <Link to={user ? `/salons/${salonId}/token?mode=book` : '/login'} className="flex-1">
                  <Button fullWidth variant="secondary" className="py-3 text-sm">📅 Book</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

