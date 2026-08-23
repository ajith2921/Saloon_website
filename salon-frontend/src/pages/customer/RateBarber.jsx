import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Star, ArrowRight, Scissors } from 'lucide-react'
import { useFetch } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { Spinner, Card, Button, Textarea } from '../../components/ui'
import api from '../../lib/api'

export default function RateBarber() {
  const { tokenId } = useParams()
  const navigate = useNavigate()
  const { success, error: showError } = useToast()

  const { data: token, loading } = useFetch(tokenId ? `/api/tokens/${tokenId}` : null)

  const [rating, setRating]   = useState(0)
  const [hover, setHover]     = useState(0)
  const [review, setReview]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) { showError('Please select a rating.'); return }
    setSubmitting(true)
    try {
      await api.post('/api/ratings', {
        token_id: tokenId,
        rating,
        review: review.trim() || null,
      })
      setSubmitted(true)
      success('Thank you for your feedback!', 'Rating submitted')
    } catch (err) {
      showError(err.message || 'Could not submit rating.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  if (submitted) return (
    <div className="container-app max-w-sm mx-auto py-16 text-center">
      <div className="text-6xl mb-4">🌟</div>
      <h2 className="text-2xl font-bold text-white mb-2">Thanks for rating!</h2>
      <p className="text-dark-100 mb-6">Your feedback helps improve the experience for everyone.</p>
      <Button onClick={() => navigate('/')} fullWidth>
        Back to Home <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  )

  return (
    <div className="container-app max-w-sm mx-auto py-12">
      <Card className="p-6">
        {/* Worker info */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center mx-auto mb-3 shadow-glow-sm">
            {token?.workers?.photo_url ? (
              <img src={token.workers.photo_url} className="w-16 h-16 rounded-2xl object-cover" alt="" />
            ) : (
              <Scissors className="w-8 h-8 text-white" />
            )}
          </div>
          <h2 className="text-xl font-bold text-white">{token?.workers?.name ?? 'Your Barber'}</h2>
          <p className="text-dark-100 text-sm mt-0.5">{token?.salons?.name}</p>
          <p className="text-xs text-dark-200 mt-0.5">Service: {token?.services?.name}</p>
        </div>

        <h3 className="text-base font-semibold text-white text-center mb-4">How was your experience?</h3>

        {/* Star selector */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(s)}
              className="transition-transform hover:scale-110 active:scale-95"
            >
              <Star
                className={`w-10 h-10 transition-colors ${
                  s <= (hover || rating)
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-dark-400'
                }`}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-center text-sm font-medium text-amber-400 mb-4">
            {['', 'Poor', 'Below Average', 'Good', 'Very Good', 'Excellent!'][rating]}
          </p>
        )}

        {/* Review text */}
        <Textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Share your experience (optional)…"
          rows={3}
          className="resize-none mb-2"
          maxLength={500}
        />
        <p className="text-xs text-dark-300 text-right mb-4">{review.length}/500</p>

        <Button
          id="btn-submit-rating"
          onClick={handleSubmit}
          disabled={rating === 0}
          loading={submitting}
          fullWidth
        >
          Submit Rating
        </Button>
      </Card>
    </div>
  )
}
