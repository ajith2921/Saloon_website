import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Ticket, ArrowRight, Star, FileText } from 'lucide-react'
import { useTokenHistory } from '../../hooks/useApi'
import { TokenBadge, Spinner, Skeleton, EmptyState, ErrorState, Card, Button, PageHeader, Modal } from '../../components/ui'

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function History() {
  const { data, loading, error, refetch } = useTokenHistory()
  const tokens = data?.tokens ?? []
  const [receiptToken, setReceiptToken] = useState(null)

  return (
    <div className="container-app max-w-2xl mx-auto py-8">
      <PageHeader title="Visit History" />

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      )}

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
              
              {token.status === 'completed' && (
                <div className="pt-3 sm:pt-0 border-t border-white/5 sm:border-t-0 mt-3 sm:mt-0 flex-shrink-0 flex items-center gap-2">
                  {!token.ratings?.length && (
                    <Link to={`/rate/${token.id}`} className="block">
                      <Button variant="secondary" className="w-full sm:w-auto text-xs px-4 py-2 h-auto shadow-glow-sm">
                        <Star className="w-3.5 h-3.5 mr-1.5" /> Rate
                      </Button>
                    </Link>
                  )}
                  <Button variant="ghost" onClick={() => setReceiptToken(token)} className="text-xs px-3 py-2 h-auto text-dark-200 hover:text-white">
                     <FileText className="w-3.5 h-3.5 mr-1" /> Receipt
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!receiptToken} onClose={() => setReceiptToken(null)} title="Payment Receipt" titleId="receipt-title">
        {receiptToken && (
          <div className="flex flex-col gap-4 text-sm text-dark-100 p-2">
            <div className="text-center pb-4 border-b border-white/10">
              <h3 className="font-bold text-white text-xl">{receiptToken.salons?.name}</h3>
              {receiptToken.salons?.city && <p className="mt-1">{receiptToken.salons?.city}</p>}
            </div>
            <div className="flex justify-between py-1">
              <span>Date</span>
              <span className="text-white font-medium">{formatDate(receiptToken.created_at)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Token Number</span>
              <span className="text-white font-medium">#{receiptToken.token_number}</span>
            </div>
            <div className="flex justify-between py-1 border-t border-white/10 pt-4 mt-2">
              <span>{receiptToken.services?.name}</span>
              <span className="text-white font-medium">₹{receiptToken.services?.price}</span>
            </div>
            <div className="flex justify-between py-3 mt-2 border-t border-white/10 font-bold text-base">
              <span className="text-white">Total</span>
              <span className="text-brand-400">₹{receiptToken.services?.price}</span>
            </div>
            <Button className="mt-4 print:hidden" onClick={() => window.print()} fullWidth>
              Print PDF
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
