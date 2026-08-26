import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import api from '../lib/api'

export function useRealtimeQueue(salonId, onTokenChange, adminMode = false) {
  const endpoint = adminMode
    ? `/api/salons/${salonId}/queue/admin`
    : `/api/salons/${salonId}/queue/live`

  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: [endpoint],
    queryFn: async () => {
      const { data } = await api.get(endpoint)
      return data.tokens ?? []
    },
    enabled: !!salonId,
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

    const tableToWatch = adminMode ? 'tokens' : 'live_queue'

    const channel = supabase.channel(`queue:${salonId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: tableToWatch,
        filter: `salon_id=eq.${salonId}`
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const oldData = queryClient.getQueryData([endpoint])
          const existingToken = oldData?.find(t => t.id === payload.new.id)
          
          const foreignKeyChanged = existingToken && (
            (payload.new.worker_id !== undefined && existingToken.worker_id !== payload.new.worker_id) ||
            (payload.new.service_id !== undefined && existingToken.service_id !== payload.new.service_id)
          )

          if (foreignKeyChanged) {
            // Trigger targeted refetch for relational data (e.g. worker name changed)
            refetch()
          } else {
            // Safely patch the cache for primitive changes (e.g. status changed to 'serving')
            queryClient.setQueryData([endpoint], (old) => {
              if (!old) return old
              return old.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t)
            })
          }
        } else {
          // INSERT or DELETE requires full refetch to get relational data or cleanup
          refetch()
        }
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          // Fetch immediately on connect/reconnect to capture missed events
          refetch()
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [salonId, refetch, endpoint, queryClient, adminMode])

  const activeTokens  = tokens.filter((t) => ['waiting', 'called', 'serving'].includes(t.status))
  const currentToken  = tokens.find((t) => t.status === 'serving') ?? tokens.find((t) => t.status === 'called')
  const waitingTokens = tokens.filter((t) => t.status === 'waiting')

  return { tokens, activeTokens, currentToken, waitingTokens, loading: isLoading, refetch }
}

export function useRealtimeToken(tokenId, onStatusChange) {
  const queryClient = useQueryClient()
  const { data: tokenData, refetch } = useQuery({
    queryKey: ['/api/tokens', tokenId],
    queryFn: async () => {
      const { data } = await api.get(`/api/tokens/${tokenId}`)
      return data
    },
    enabled: !!tokenId,
  })

  useEffect(() => {
    if (tokenData?.status) {
      onStatusChange?.(tokenData)
    }
  }, [tokenData, onStatusChange])

  useEffect(() => {
    if (!tokenId) return
    const channel = supabase.channel(`token:${tokenId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_queue', // Fixed: Use live_queue to bypass RLS blocks on public customers
        filter: `id=eq.${tokenId}`
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const oldData = queryClient.getQueryData(['/api/tokens', tokenId])
          const foreignKeyChanged = oldData && (
              (payload.new.worker_id !== undefined && oldData.worker_id !== payload.new.worker_id) ||
              (payload.new.service_id !== undefined && oldData.service_id !== payload.new.service_id)
          )

          if (foreignKeyChanged) {
            refetch()
          } else {
            queryClient.setQueryData(['/api/tokens', tokenId], (old) => {
              if (!old) return old
              return { ...old, ...payload.new }
            })
          }
        } else if (payload.eventType === 'DELETE') {
          // Token completed/cancelled and was pruned from live_queue, refetch to get final status
          refetch()
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          refetch()
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tokenId, queryClient, refetch])

  return { tokenData, refetch }
}
