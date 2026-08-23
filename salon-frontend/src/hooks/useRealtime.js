import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

const PUBLIC_QUEUE_REFRESH_MS = 10_000
const PRIVATE_TOKEN_REFRESH_MS = 8_000

export function useRealtimeQueue(salonId, onTokenChange, adminMode = false) {
  const queryClient = useQueryClient()
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

  const tokens = data ?? []

  useEffect(() => {
    if (tokens.length > 0) {
      onTokenChange?.(tokens)
    }
  }, [tokens, onTokenChange])

  const activeTokens  = tokens.filter((t) => ['waiting', 'called', 'serving'].includes(t.status))
  const currentToken  = tokens.find((t) => t.status === 'serving') ?? tokens.find((t) => t.status === 'called')
  const waitingTokens = tokens.filter((t) => t.status === 'waiting')

  return { tokens, activeTokens, currentToken, waitingTokens, loading: isLoading, refetch }
}

export function useRealtimeToken(tokenId, onStatusChange) {
  const { data: tokenData, isLoading, refetch } = useQuery({
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

