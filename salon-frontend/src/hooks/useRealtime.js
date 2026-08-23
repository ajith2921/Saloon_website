import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

// Public queue data is intentionally fetched from the backend. A direct browser
// subscription to `tokens` would require public SELECT access and expose fields
// such as customer_id. This keeps the public payload limited to safe queue data.
const PUBLIC_QUEUE_REFRESH_MS = 10_000
const PRIVATE_TOKEN_REFRESH_MS = 8_000

export function useRealtimeQueue(salonId, onTokenChange, adminMode = false) {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)

  const loadTokens = useCallback(async () => {
    if (!salonId) {
      setTokens([])
      setLoading(false)
      return
    }
    try {
      const endpoint = adminMode
        ? `/api/salons/${salonId}/queue/admin`
        : `/api/salons/${salonId}/queue/live`
      const { data } = await api.get(endpoint)
      const nextTokens = data.tokens ?? []
      setTokens(nextTokens)
      onTokenChange?.(nextTokens)
    } catch {
      // Keep the last known queue visible during a transient network failure.
    } finally {
      setLoading(false)
    }
  }, [salonId, onTokenChange, adminMode])

  useEffect(() => {
    loadTokens()
    if (!salonId) return undefined
    const timer = window.setInterval(loadTokens, PUBLIC_QUEUE_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [salonId, loadTokens])

  const activeTokens  = tokens.filter((t) => ['waiting', 'called', 'serving'].includes(t.status))
  const currentToken  = tokens.find((t) => t.status === 'serving') ?? tokens.find((t) => t.status === 'called')
  const waitingTokens = tokens.filter((t) => t.status === 'waiting')

  return { tokens, activeTokens, currentToken, waitingTokens, loading, refetch: loadTokens }
}

// Private token status uses the protected API, which verifies ownership before
// returning the record. It is polling temporarily; secure broadcast channels
// can be introduced later without reopening table-level reads.
export function useRealtimeToken(tokenId, onStatusChange) {
  const [tokenData, setTokenData] = useState(null)

  const loadToken = useCallback(async () => {
    if (!tokenId) return
    try {
      const { data } = await api.get(`/api/tokens/${tokenId}`)
      setTokenData((previous) => {
        if (previous?.status && previous.status !== data.status) onStatusChange?.(data)
        return data
      })
    } catch {
      // The main token page owns the visible error/empty state.
    }
  }, [tokenId, onStatusChange])

  useEffect(() => {
    if (!tokenId) {
      setTokenData(null)
      return undefined
    }
    loadToken()
    const timer = window.setInterval(loadToken, PRIVATE_TOKEN_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [tokenId, loadToken])

  return { tokenData, refetch: loadToken }
}
