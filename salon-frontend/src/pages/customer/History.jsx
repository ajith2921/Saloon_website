import { Link } from 'react-router-dom'
import { Ticket, ArrowRight, Star } from 'lucide-react'
import { useTokenHistory } from '../../hooks/useApi'
import { TokenBadge, Spinner, EmptyState, ErrorState, Card, Button, PageHeader } from '../../components/ui'

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function History() {
  const { data, loading, error, refetch } = useTokenHistory()
  const tokens = data?.tokens ?? []

  return (
    <div className="container-app max-w-2xl mx-auto py-8">
      <PageHeader title="Visit History" />

      {loading && <div className="flex justify-center py-16"><Spinner size="lg" /></div>}

      {!loading && error && (
        <ErrorState
          title="Couldn't load history"
          message="There was a problem fetching your visit history. Please try again."
          onRetry={refetch}
        />
      )}

      {!loading && !error && tokens.length === 0 && (
        <EmptyState
          icon={Ticket}
          title="No history yet"
          description="Your past salon visits will appear here."
          action={
            <Link to="/salons">
              <Button>Find a Salon <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </Link>
          }
        />
      )}

      {!loading && !error && tokens.length > 0 && (
        <div className="flex flex-col gap-3">
          {tokens.map((token) => (
            <Card key={token.id} hover className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 group">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-surface-tertiary flex items-center justify-center flex-shrink-0 group-hover:bg-brand-500/10 transition-colors border border-transparent group-hover:border-brand-500/20">
                  <span className="font-bold text-white text-sm">#{token.token_number}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-white text-sm truncate pr-2">
                      {token.salons?.name ?? 'Salon'}
                    </p>
                    {token.services?.price && (
                      <span className="text-xs text-brand-400 font-bold whitespace-nowrap">₹{token.services.price}</span>
                    )}
                  </div>
                  <p className="text-xs text-dark-200 mt-0.5">
                    {token.services?.name} · {formatDate(token.created_at)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <TokenBadge status={token.status} />
                  </div>
                </div>
              </div>
              
              {token.status === 'completed' && !token.ratings?.length && (
                <div className="pt-3 sm:pt-0 border-t border-white/5 sm:border-t-0 mt-3 sm:mt-0 flex-shrink-0">
                  <Link to={`/rate/${token.id}`} className="block">
                    <Button variant="secondary" className="w-full sm:w-auto text-xs px-4 py-2 h-auto shadow-glow-sm">
                      <Star className="w-3.5 h-3.5 mr-1.5" /> Rate Barber
                    </Button>
                  </Link>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
