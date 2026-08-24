import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import api from '../lib/api'

const PUBLIC_QUEUE_REFRESH_MS = 10_000
const PRIVATE_TOKEN_REFRESH_MS = 8_000

export function useRealtimeQueue(salonId, onTokenChange, adminMode = false) {
  const endpoint = adminMode
    ? `/api/salons/${salonId}/queue/admin`
    : `/api/salons/${salonId}/queue/live`

  const { data, isLoading, refetch } = useQuery({
    queryKey: [endpoint],
    queryFn: async () => {
      const { data } = await api.get(endpoint)
      return data.tokens ?? []
    },
    enabled: !!salonId,
    refetchInterval: PUBLIC_QUEUE_REFRESH_MS,
    staleTime: 5000,
  })

  // Memoize tokens to prevent infinite loops in consumers
  const tokens = useMemo(() => data ?? [], [data])

  useEffect(() => {
    if (tokens.length > 0) {
      onTokenChange?.(tokens)
    }
  }, [tokens, onTokenChange])

  useEffect(() => {
    if (!salonId) return

    const channel = supabase.channel(`queue:${salonId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tokens',
        filter: `salon_id=eq.${salonId}`
      }, () => {
        refetch()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [salonId, refetch])

  const activeTokens  = tokens.filter((t) => ['waiting', 'called', 'serving'].includes(t.status))
  const currentToken  = tokens.find((t) => t.status === 'serving') ?? tokens.find((t) => t.status === 'called')
  const waitingTokens = tokens.filter((t) => t.status === 'waiting')

  return { tokens, activeTokens, currentToken, waitingTokens, loading: isLoading, refetch }
}

export function useRealtimeToken(tokenId, onStatusChange) {
  const { data: tokenData, refetch } = useQuery({
    queryKey: ['/api/tokens', tokenId],
    queryFn: async () => {
      const { data } = await api.get(`/api/tokens/${tokenId}`)
      return data
    },
    enabled: !!tokenId,
    refetchInterval: PRIVATE_TOKEN_REFRESH_MS,
  })

  useEffect(() => {
    if (tokenData?.status) {
      onStatusChange?.(tokenData)
    }
  }, [tokenData, onStatusChange])

  return { tokenData, refetch }
}

