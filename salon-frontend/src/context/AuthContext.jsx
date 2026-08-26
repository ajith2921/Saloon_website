import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error && data) {
      setProfile(data)
      if (data.role === 'salon_owner' || data.role === 'worker') {
        try {
          const res = await api.get('/api/salons/mine');
          setProfile(p => ({ ...p, salons: [res.data] }))
        } catch (e) {
          console.warn('Could not fetch salon for admin:', e)
        }
      }
    }
  }, [])

  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).then(async () => {
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        await fetchProfile(session?.user?.id)
      }
    )
    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signUp = async ({ email, password, fullName, phone }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
      },
    })
    if (error) throw error
    return data
  }

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const PROFILE_UPDATE_ALLOWLIST = ['full_name', 'phone', 'avatar_url']

  const updateProfile = async (updates) => {
    if (!user) throw new Error('Not authenticated')
    // Allowlist: only permit safe user-editable fields. Role, loyalty_points,
    // referral_code, and all other sensitive fields are stripped here (and also
    // enforced by the database trigger in migration 014).
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => PROFILE_UPDATE_ALLOWLIST.includes(key))
    )
    if (Object.keys(safeUpdates).length === 0) {
      throw new Error('No valid fields to update')
    }
    const { data, error } = await supabase
      .from('profiles')
      .update(safeUpdates)
      .eq('id', user.id)
      .select()
      .single()
    if (error) throw error
    setProfile(data)
    return data
  }

  const refreshProfile = () => fetchProfile(user?.id)

  const value = {
    user,
    profile,
    loading,
    role: profile?.role ?? null,
    isCustomer: profile?.role === 'customer',
    isWorker: profile?.role === 'worker',
    isOwner: profile?.role === 'salon_owner',
    isSuperAdmin: profile?.role === 'super_admin',
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
