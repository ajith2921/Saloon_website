import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

/**
 * Generic data fetching hook
 */
export function useFetch(url, params = {}, dependencies = []) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const paramsKey = JSON.stringify(params)

  const fetch = useCallback(async () => {
    if (!url) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(url, { params })
      setData(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey])

  useEffect(() => {
    fetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetch, ...dependencies])

  return { data, loading, error, refetch: fetch }
}

/**
 * Salons list
 */
export function useSalons(params) {
  return useFetch('/api/salons', params)
}

/**
 * Single salon
 */
export function useSalon(salonId) {
  return useFetch(salonId ? `/api/salons/${salonId}` : null)
}

/**
 * Salon services
 */
export function useSalonServices(salonId) {
  return useFetch(salonId ? `/api/salons/${salonId}/services` : null)
}

/**
 * Salon workers
 */
export function useSalonWorkers(salonId) {
  return useFetch(salonId ? `/api/salons/${salonId}/workers` : null)
}

/**
 * Live queue snapshot
 */
export function useLiveQueue(salonId) {
  return useFetch(salonId ? `/api/salons/${salonId}/queue/live` : null)
}

/**
 * Customer's active token
 */
export function useMyToken(enabled = true) {
  return useFetch(enabled ? '/api/tokens/my' : null)
}

/**
 * Token history
 */
export function useTokenHistory() {
  return useFetch('/api/tokens/history')
}

/**
 * Admin salon stats
 */
export function useSalonStats(salonId) {
  return useFetch(salonId ? `/api/salons/${salonId}/stats` : null)
}

/**
 * Notifications
 */
export function useNotifications() {
  return useFetch('/api/notifications')
}

/**
 * Salon customers (admin only)
 */
export function useSalonCustomers(salonId) {
  return useFetch(salonId ? `/api/salons/${salonId}/customers` : null)
}
