import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Ticket, Clock, Users, RefreshCw, X, Bell,
  ArrowRight, CheckCircle, AlertTriangle
} from 'lucide-react'
import { useMyToken } from '../../hooks/useApi'
import { useRealtimeToken, useRealtimeQueue } from '../../hooks/useRealtime'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { useToast } from '../../context/ToastContext'
import { TokenBadge, Skeleton, EmptyState, ConfirmModal, Card, Button, PageHeader } from '../../components/ui'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'

const STATUS_CONFIG = {
  waiting: {
    color: 'border-blue-500/20 bg-blue-500/5',
    label: 'Waiting',
    icon: Clock,
    iconColor: 'text-blue-400',
  },
  called: {
    color: 'border-amber-500/40 bg-amber-500/10',
    label: 'You\'ve Been Called!',
    icon: Bell,
    iconColor: 'text-amber-400',
  },
  serving: {
    color: 'border-brand-500/40 bg-brand-500/10',
    label: 'In Service',
    icon: CheckCircle,
    iconColor: 'text-brand-400',
  },
  completed: {
    color: 'border-green-500/20 bg-green-500/5',
    label: 'Service Complete',
    icon: CheckCircle,
    iconColor: 'text-green-400',
  },
  cancelled: {
    color: 'border-red-500/20 bg-red-500/5',
    label: 'Token Cancelled',
    icon: X,
    iconColor: 'text-red-400',
  },
}

export default function MyToken() {
  const { t } = useTranslation()
  const { data, loading, refetch } = useMyToken()
  const { success, warning, info } = useToast()
  const { isSupported, isSubscribed, permission, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications()
  const [cancelling, setCancelling] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const token = data ?? null

  // Subscribe to live updates on this token
  const handleStatusChange = useCallback((newTokenData) => {
    if (newTokenData.status === 'called') {
      warning('Your turn is approaching! Please proceed to the salon soon.', '🔔 Token Called!')
    }
    if (newTokenData.status === 'serving') {
      info('You are now being served. Enjoy your haircut!', '✂️ In Service')
    }
    if (newTokenData.status === 'completed') {
      success('Service completed. Please rate your barber!', '✅ Complete')
    }
  }, [warning, info, success])

  useRealtimeToken(token?.id, handleStatusChange)

  // Live queue for position calculation
  const { waitingTokens, currentToken } = useRealtimeQueue(token?.salon_id)

  const position = token?.status === 'waiting'
    ? waitingTokens.findIndex((t) => t.id === token?.id) + 1
    : null

  const eta = position != null && position > 0
    ? position * (token?.services?.duration_minutes ?? 30)
    : 0

  const handleCancelConfirm = async () => {
    if (!token) return
    setConfirmOpen(false)
    setCancelling(true)
    try {
      await api.put(`/api/tokens/${token.id}/cancel`)
      success('Token cancelled successfully.')
      refetch()
    } catch (err) {
      warning(err.message || 'Could not cancel token.')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return (
    <div className="container-app max-w-md mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl mb-6" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  )

  // No active token
  if (!token || ['completed', 'cancelled', 'expired'].includes(token.status)) {
    const isDone = token && ['completed', 'cancelled', 'expired'].includes(token.status)
    return (
      <div className="container-app max-w-md mx-auto py-12">
        {isDone && token.status === 'completed' && (
          <Card className="p-6 text-center mb-4 border-green-500/20 bg-green-500/5 animate-fade-in">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-1">Service Complete!</h2>
            <p className="text-dark-100 text-sm">Hope you loved your haircut. Don't forget to rate your barber!</p>
            <Link to={`/rate/${token.id}`} className="block w-full mt-4">
              <Button fullWidth>Rate Your Barber <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </Link>
          </Card>
        )}
        <EmptyState
          icon={Ticket}
          title="No active token"
          description="You don't have an active queue token. Find a salon and get one now!"
          action={
            <Link to="/salons">
              <Button>Find a Salon <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </Link>
          }
        />
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[token.status] ?? STATUS_CONFIG.waiting

  return (
    <div className="container-app max-w-md mx-auto py-8">
      <PageHeader 
        title="My Token"
        action={
          <Button variant="icon" onClick={refetch}>
            <RefreshCw className="w-5 h-5" />
          </Button>
        }
      />

      {/* Status banner */}
      {token.status === 'called' && (
        <Card className="p-4 mb-4 border-amber-500/40 bg-amber-500/10 animate-pulse-slow">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-amber-400" />
            <div>
              <p className="font-bold text-amber-400">Your turn is approaching!</p>
              <p className="text-sm text-dark-100">Please head to the salon now.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Main token card */}
      <Card className={`p-6 border-2 ${statusCfg.color} mb-6 bg-gradient-card shadow-glow-sm relative overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-radial from-brand-500/10 to-transparent pointer-events-none" />
        
        <div className="text-center mb-8 relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-dark-200 mb-2">{t('home.your_token', 'Your Token')}</p>
          <div className="animate-token">
            <p className="font-display text-[7rem] sm:text-[8rem] font-black text-white leading-none drop-shadow-lg mb-2">#{token.token_number}</p>
          </div>
          <TokenBadge status={token.status} />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 relative z-10">
          <div className="bg-surface-primary/60 border border-white/5 rounded-2xl p-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-200 mb-1">{t('salonDetails.now_serving', 'Serving')}</p>
            <p className="font-display font-bold text-white text-2xl leading-none">
              {currentToken ? `#${currentToken.token_number}` : '—'}
            </p>
          </div>
          <div className="bg-surface-primary/60 border border-white/5 rounded-2xl p-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-200 mb-1">{t('token.queue_ahead', 'Ahead')}</p>
            <p className="font-display font-bold text-white text-2xl leading-none">
              {position != null ? Math.max(0, position - 1) : '—'}
            </p>
          </div>
          <div className="bg-brand-500/5 border border-brand-500/10 rounded-2xl p-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-200 mb-1">{t('home.est_wait', 'Est. Wait')}</p>
            <p className="font-display font-bold text-brand-400 text-2xl leading-none">
              {eta === 0 ? 'Soon!' : `~${eta}m`}
            </p>
          </div>
        </div>

        {/* Service info */}
        <div className="bg-surface-tertiary rounded-xl p-3 flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-dark-200">Service</p>
            <p className="font-semibold text-white text-sm">{token.services?.name ?? 'Haircut'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-dark-200">Salon</p>
            <p className="font-semibold text-white text-sm truncate max-w-[120px]">
              {token.salons?.name ?? '—'}
            </p>
          </div>
        </div>

        {/* Queue visual */}
        {token.status === 'waiting' && waitingTokens.length > 0 && (
          <div className="mb-6 relative z-10">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-200 mb-3">Queue Position</p>
            <div className="flex flex-wrap gap-2">
              {waitingTokens.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                    t.id === token.id
                      ? 'bg-brand-500 text-white ring-4 ring-brand-500/20 scale-110 z-10 shadow-glow-sm'
                      : 'bg-surface-primary border border-white/5 text-dark-200'
                  }`}
                >
                  #{t.token_number}
                </div>
              ))}
              {waitingTokens.length > 10 && (
                <div className="w-10 h-10 rounded-xl bg-surface-primary border border-white/5 flex items-center justify-center text-sm text-dark-200">
                  +{waitingTokens.length - 10}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {['waiting', 'called'].includes(token.status) && (
            <Button
              variant="danger"
              onClick={() => setConfirmOpen(true)}
              loading={cancelling}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-1" /> {t('token.cancel_token', 'Cancel Token')}
            </Button>
          )}
          <Link to={`/queue/${token.salon_id}`} className="flex-1">
            <Button variant="secondary" fullWidth>
              <Users className="w-4 h-4 mr-1" /> {t('salonDetails.live_queue', 'Live Queue')}
            </Button>
          </Link>
        </div>
      </Card>

      {/* Styled confirmation modal — replaces window.confirm() */}
      <ConfirmModal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleCancelConfirm}
        title="Cancel Your Token?"
        message="Are you sure you want to cancel your queue token? You will lose your position and will need to get a new token."
        confirmLabel="Yes, Cancel Token"
        danger
      />

      {isSupported && permission !== 'denied' && (
        <Card className="p-4 mb-4 mt-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-brand-400" />
              <div>
                <p className="font-bold text-white text-sm">Get Notified</p>
                <p className="text-xs text-dark-200">Alert me when it's my turn</p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant={isSubscribed ? "secondary" : "primary"} 
              loading={pushLoading}
              onClick={isSubscribed ? unsubscribe : subscribe}
            >
              {isSubscribed ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </Card>
      )}

      <p className="text-xs text-dark-200 text-center flex items-center justify-center gap-1 mt-4">
        <AlertTriangle className="w-3 h-3" />
        Queue updates automatically. No need to refresh.
      </p>
    </div>
  )
}

