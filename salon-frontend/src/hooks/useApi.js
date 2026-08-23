import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { supabase } from '../lib/supabase'

/**
 * Generic data fetching hook using React Query
 * Keeps backward compatibility with { data, loading, error, refetch }
 */
export function useFetch(url, params = {}, dependencies = []) {
  const paramsKey = JSON.stringify(params)
  const queryKey = [url, paramsKey, ...dependencies]

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get(url, { params })
      return res.data
    },
    enabled: !!url,
  })

  return { data, loading: isLoading, error: error?.message || null, refetch }
}

export function useSalons(params) {
  return useFetch('/api/salons', params)
}

export function useSalon(salonId) {
  return useFetch(salonId ? `/api/salons/${salonId}` : null)
}

export function useSalonServices(salonId) {
  return useFetch(salonId ? `/api/salons/${salonId}/services` : null)
}

export function useSalonWorkers(salonId) {
  return useFetch(salonId ? `/api/salons/${salonId}/workers` : null)
}

/**
 * Live queue snapshot (WITH REALTIME SUBSCRIPTION)
 */
export function useLiveQueue(salonId) {
  const queryClient = useQueryClient()
  const result = useFetch(salonId ? `/api/salons/${salonId}/queue/live` : null)

  useEffect(() => {
    if (!salonId) return

    const channel = supabase
      .channel(`public:tokens:salon_id=eq.${salonId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens', filter: `salon_id=eq.${salonId}` },
        (payload) => {
          console.log('Realtime token update!', payload)
          // Invalidate the live queue query so React Query refetches it instantly in the background
          queryClient.invalidateQueries({ queryKey: [`/api/salons/${salonId}/queue/live`] })
          queryClient.invalidateQueries({ queryKey: [`/api/salons/${salonId}/queue/admin`] })
          queryClient.invalidateQueries({ queryKey: [`/api/salons/${salonId}/stats`] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [salonId, queryClient])

  return result
}

export function useMyToken(enabled = true) {
  return useFetch(enabled ? '/api/tokens/my' : null)
}

export function useTokenHistory() {
  return useFetch('/api/tokens/history')
}

export function useSalonStats(salonId) {
  return useFetch(salonId ? `/api/salons/${salonId}/stats` : null)
}

export function useNotifications() {
  return useFetch('/api/notifications')
}

export function useSalonCustomers(salonId) {
  return useFetch(salonId ? `/api/salons/${salonId}/customers` : null)
}

export function useSubscriptionPlans() {
  return useFetch('/api/subscriptions/plans')
}

export function useMySubscription() {
  return useFetch('/api/subscriptions/me')
}

export function useMyEntitlements() {
  return useFetch('/api/subscriptions/entitlements')
}
