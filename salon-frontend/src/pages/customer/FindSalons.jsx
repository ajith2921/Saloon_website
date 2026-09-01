import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin, Clock, Users, Search, SlidersHorizontal,
  Scissors, X, RefreshCw, Map
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useSalons } from '../../hooks/useApi'
import { StarRating, EmptyState, Skeleton, Button, Input, Select, Card, PageHeader } from '../../components/ui'

import { useTranslation } from 'react-i18next'

const SORT_OPTIONS = (t) => [
  { value: 'rating', label: t('findSalons.highest_rated') },
  { value: 'queue',  label: t('findSalons.shortest_queue') },
  { value: 'dist',   label: t('findSalons.nearest') },
]

function SalonCard({ salon, t }) {
  const now = new Date()
  const [oh, om] = (salon.opening_time ?? '09:00').split(':').map(Number)
  const [ch, cm] = (salon.closing_time ?? '21:00').split(':').map(Number)
  const mins = now.getHours() * 60 + now.getMinutes()
  const isOpen = salon.status === 'active' && mins >= oh * 60 + om && mins < ch * 60 + cm
  const waitMins = (salon.queue_count ?? 0) * (salon.avg_service_minutes ?? 30)

  return (
    <Card hover className="flex flex-col sm:flex-row p-0 overflow-hidden">
      {/* Image */}
      <div className="sm:w-44 h-40 sm:h-auto bg-surface-tertiary flex-shrink-0 relative">
        {salon.cover_image_url ? (
          <img src={salon.cover_image_url} alt={salon.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Scissors className="w-10 h-10 text-dark-300" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className={isOpen ? 'badge bg-success/20 text-success border border-success/20 backdrop-blur-md' : 'badge bg-dark-400/50 text-white backdrop-blur-md'}>
            {isOpen ? t('findSalons.open_now') : t('findSalons.closed')}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-white text-base">{salon.name}</h3>
              <div className="flex items-center gap-3 mt-1">
                <StarRating rating={salon.avg_rating ?? 4.5} />
                {salon.distance_km != null && (
                  <span className="flex items-center gap-0.5 text-xs text-dark-200">
                    <MapPin className="w-3 h-3" />
                    {salon.distance_km < 1
                      ? `${Math.round(salon.distance_km * 1000)}m`
                      : `${salon.distance_km.toFixed(1)}km`} away
                  </span>
                )}
              </div>
            </div>
            {salon.starting_price != null && (
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-dark-200">Starting</p>
                <p className="font-bold text-brand-400">₹{salon.starting_price}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 mt-2 text-xs text-dark-200">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{salon.address ?? salon.city}</span>
          </div>

          {/* Queue stats */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-2 bg-surface-primary/50 border border-white/5 rounded-lg px-3 py-2">
              <Users className="w-4 h-4 text-dark-200" />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-dark-200 uppercase tracking-wider leading-none">Waiting</span>
                <span className="text-lg font-display font-bold text-white leading-none mt-0.5">{salon.queue_count ?? 0}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-brand-500/5 border border-brand-500/10 rounded-lg px-3 py-2">
              <Clock className="w-4 h-4 text-brand-400" />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-dark-200 uppercase tracking-wider leading-none">{t('findSalons.est_wait', 'Est. Wait')}</span>
                <span className="text-lg font-display font-bold text-brand-400 leading-none mt-0.5">
                  {waitMins === 0 ? '0m' : `~${waitMins}m`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Link to={`/salons/${salon.id}`} className="flex-1">
            <Button variant="secondary" fullWidth className="text-sm">{t('findSalons.view_salon', 'View Salon')}</Button>
          </Link>
          {isOpen && (
            <Link to={`/salons/${salon.id}/token`} className="flex-1">
              <Button fullWidth className="text-sm"><Ticket2 className="w-4 h-4" /> {t('findSalons.get_token', 'Get Token')}</Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  )
}

function Ticket2(props) {
  return <Scissors {...props} />
}

export default function FindSalons() {
  const { t } = useTranslation()
  const [search, setSearch]   = useState('')
  const [sortBy, setSortBy]   = useState('rating')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [showMap, setShowMap] = useState(false)

  const { data, loading, error, refetch } = useSalons({ status: 'active', limit: 50 })
  
  const allSalons = useMemo(() => Array.isArray(data) ? data : (data?.salons ?? []), [data])

  const filtered = useMemo(() => {
    let list = [...allSalons]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q)
      )
    }

    if (onlyOpen) {
      const now = new Date()
      const mins = now.getHours() * 60 + now.getMinutes()
      list = list.filter((s) => {
        const [oh, om] = (s.opening_time ?? '09:00').split(':').map(Number)
        const [ch, cm] = (s.closing_time ?? '21:00').split(':').map(Number)
        return mins >= oh * 60 + om && mins < ch * 60 + cm
      })
    }

    if (sortBy === 'rating') list.sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0))
    if (sortBy === 'queue')  list.sort((a, b) => (a.queue_count ?? 0) - (b.queue_count ?? 0))
    if (sortBy === 'dist')   list.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999))

    return list
  }, [allSalons, search, sortBy, onlyOpen])

  return (
    <div className="container-app py-8">
      <PageHeader 
        title={t('findSalons.title', 'Find Your Salon')}
        subtitle={allSalons.length > 0
          ? `${allSalons.length} ${t('findSalons.salons_available', 'salons available · Choose by rating, queue, or distance')}`
          : t('findSalons.discover_nearby', 'Discover nearby men\'s salons')} 
      />

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Input
            id="salon-search"
            type="text"
            icon={Search}
            placeholder={t('findSalons.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10"
          />
          {search && (
            <button 
              onClick={() => setSearch('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-200 hover:text-white z-10"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort */}
        <Select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          wrapperClassName="w-full sm:w-auto min-w-[160px]"
        >
          {SORT_OPTIONS(t).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>

        <Button
          variant="secondary"
          onClick={() => setOnlyOpen(!onlyOpen)}
          className={`whitespace-nowrap ${onlyOpen ? 'border-brand-500/40 text-brand-400' : ''}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {onlyOpen ? t('findSalons.open_now_checked', 'Open Now ✓') : t('findSalons.filter', 'Filter')}
        </Button>

        <Button 
          variant="secondary"
          onClick={() => setShowMap(!showMap)} 
          className={`whitespace-nowrap ${showMap ? 'border-brand-500/40 text-brand-400' : ''}`}
        >
          <Map className="w-4 h-4" />
          {showMap ? t('findSalons.hide_map', 'Hide Map') : t('findSalons.show_map', 'Show Map')}
        </Button>

        <Button variant="icon" onClick={refetch} title={t('common.refresh', 'Refresh')}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Map View */}
      {showMap && (
        <div className="mb-6 h-80 rounded-xl overflow-hidden border border-white/10 relative z-0 animate-fade-in shadow-card">
          <MapContainer center={[8.1833, 77.4119]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {filtered.map(s => s.latitude && s.longitude && (
              <Marker key={s.id} position={[s.latitude, s.longitude]}>
                <Popup>
                  <div className="text-dark-900 font-sans p-1">
                    <strong className="block mb-1">{s.name}</strong>
                    <span className="text-sm text-dark-300 block mb-2">{s.address ?? s.city}</span>
                    <Link to={`/salons/${s.id}`} className="bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold inline-block hover:bg-brand-600">
                      {t('findSalons.view_salon', 'View Salon')}
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Results */}
      {loading && (
        <div className="flex flex-col gap-4 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {!loading && error && (
        <Card className="text-center p-8">
          <p className="text-red-400 font-medium">{t('findSalons.failed_load', 'Failed to load salons')}</p>
          <p className="text-dark-100 text-sm mt-1">{error}</p>
          <Button variant="secondary" onClick={refetch} className="mt-4">{t('common.try_again', 'Try Again')}</Button>
        </Card>
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon={Scissors}
          title={t('findSalons.no_salons', 'No salons found')}
          description={search ? t('findSalons.no_results', `No results for "${search}"`) : t('findSalons.no_salons_available', 'No salons available right now. Check back soon.')}
          action={search && (
            <Button variant="secondary" onClick={() => setSearch('')}>{t('common.clear_search', 'Clear Search')}</Button>
          )}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <p className="text-sm text-dark-200 mb-4">
            {t('findSalons.results_found', `${filtered.length} salons found`)}
          </p>
          <div className="flex flex-col gap-4">
            {filtered.map((salon) => (
              <SalonCard key={salon.id} salon={salon} t={t} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
