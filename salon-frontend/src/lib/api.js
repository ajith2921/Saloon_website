import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://saloon-website-3vjr.onrender.com',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// Global error handler
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status

    // On 401, the session is invalid/expired — sign out and redirect to login.
    // Guard against redirect loops by only acting when we are not already on the auth page.
    if (status === 401 && !window.location.pathname.startsWith('/login')) {
      await supabase.auth.signOut()
      window.location.href = '/login'
      return Promise.reject(new Error('Session expired. Please log in again.'))
    }

    const message = error.response?.data?.detail || error.message || 'Something went wrong'
    
    // Skip logging for expected 404s (e.g. no active token, no subscription)
    if (status !== 404) {
      console.warn('[API Error]', status, message)
    }
    
    return Promise.reject(new Error(message))
  }
)

export default api
