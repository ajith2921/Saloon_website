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
  
  // Start a timer for cold-starts
  config.coldStartTimer = setTimeout(() => {
    window.dispatchEvent(new CustomEvent('api-cold-start'));
  }, 3000);
  
  return config
})

// Global error handler
api.interceptors.response.use(
  (response) => {
    if (response.config?.coldStartTimer) clearTimeout(response.config.coldStartTimer);
    window.dispatchEvent(new CustomEvent('api-cold-start-resolved'));
    return response;
  },
  async (error) => {
    if (error.config?.coldStartTimer) clearTimeout(error.config.coldStartTimer);
    window.dispatchEvent(new CustomEvent('api-cold-start-resolved'));
    
    const status = error.response?.status

    // On 401, the session is invalid/expired — sign out and redirect to login.
    // Guard against redirect loops by only acting when we are not already on the auth page.
    if (status === 401 && !window.location.pathname.startsWith('/login')) {
      await supabase.auth.signOut()
      window.location.href = '/login'
      return Promise.reject(new Error('Session expired. Please log in again.'))
    }

    const rawDetail = error.response?.data?.detail

    // FastAPI 422 validation errors return detail as an array of objects like:
    // [{ loc: ["body", "name"], msg: "field required", type: "value_error.missing" }]
    // Joining them as-is produces "[object Object],[object Object]" — normalize here.
    let message
    if (Array.isArray(rawDetail)) {
      message = rawDetail
        .map(d => {
          const field = Array.isArray(d.loc) ? d.loc.filter(l => l !== 'body').join('.') : ''
          const msg = d.msg || 'Invalid value'
          return field ? `${field}: ${msg}` : msg
        })
        .join('; ')
    } else {
      message = rawDetail || error.message || 'Something went wrong'
    }
    
    // Skip logging for expected 404s (e.g. no active token, no subscription)
    if (status !== 404) {
      console.warn('[API Error]', status, message)
    }
    
    return Promise.reject(new Error(message))
  }
)

export default api
