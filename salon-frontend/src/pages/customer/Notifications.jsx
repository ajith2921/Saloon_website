import { Bell, CheckCheck, Inbox } from 'lucide-react'
import { useNotifications } from '../../hooks/useApi'
import { EmptyState, ErrorState, Spinner, Card, Button, PageHeader } from '../../components/ui'
import api from '../../lib/api'

function timeAgo(d) {
  const diff = (Date.now() - new Date(d)) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Notifications() {
  const { data, loading, error, refetch } = useNotifications()
  const notifications = data?.notifications ?? []
  const unread = notifications.filter((n) => !n.is_read).length

  const markAll = async () => {
    await api.put('/api/notifications/read-all')
    refetch()
  }

  return (
    <div className="container-app max-w-lg mx-auto py-8">
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `You have ${unread} unread messages` : 'No new messages'}
        action={
          unread > 0 && (
            <Button variant="secondary" onClick={markAll} className="text-xs px-3 py-1.5 h-auto">
              <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
            </Button>
          )
        }
      />

      {loading && <div className="flex justify-center py-16"><Spinner size="lg" /></div>}

      {!loading && error && (
        <ErrorState
          title="Couldn't load notifications"
          message="There was a problem loading your notifications. Please try again."
          onRetry={refetch}
        />
      )}

      {!loading && !error && notifications.length === 0 && (
        <EmptyState icon={Inbox} title="No notifications" description="You're all caught up! New messages will appear here." />
      )}

      {!loading && !error && notifications.length > 0 && (
        <div className="flex flex-col gap-3">
          {notifications.map((n) => (
            <Card key={n.id} className={`p-4 flex items-start gap-3 transition-colors hover:border-white/10 ${!n.is_read ? 'border-brand-500/20 bg-brand-500/5' : ''}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${!n.is_read ? 'bg-brand-500/20' : 'bg-surface-tertiary'}`}>
                <Bell className={`w-5 h-5 ${!n.is_read ? 'text-brand-400' : 'text-dark-200'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${!n.is_read ? 'text-white' : 'text-dark-100'}`}>{n.title}</p>
                <p className="text-xs text-dark-200 mt-1 leading-relaxed">{n.body}</p>
                <p className="text-[10px] font-medium text-dark-300 mt-2 uppercase tracking-wider">{timeAgo(n.created_at)}</p>
              </div>
              {!n.is_read && (
                <div className="w-2.5 h-2.5 rounded-full bg-brand-500 flex-shrink-0 mt-1.5 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
