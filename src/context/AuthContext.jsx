import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { applyTheme } from '../lib/applyTheme'

const AuthContext = createContext(null)

export const SUPPORT_EMAIL = 'trendlinkmw@gmail.com'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [bannedMessage, setBannedMessage] = useState('')

  const loadProfile = useCallback(async (userId) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileData && profileData.employment_status === 'inactive') {
      // Account has been deactivated by an administrator — kick them out immediately.
      setBannedMessage(
        `Your account has been deactivated. Please contact the system administrator at ${SUPPORT_EMAIL}.`
      )
      await supabase.auth.signOut()
      setProfile(null)
      setRoles([])
      return
    }

    applyTheme(profileData?.theme || 'system')

    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userId)

    setProfile(profileData || null)
    setRoles((roleRows || []).map(r => r.roles?.name).filter(Boolean))
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
      else {
        setProfile(null)
        setRoles([])
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const hasRole = (...names) => names.some(n => roles.includes(n))

  const signOut = () => supabase.auth.signOut()

  const clearBannedMessage = () => setBannedMessage('')

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null, profile, roles, hasRole, loading, signOut,
      bannedMessage, clearBannedMessage,
      refreshProfile: () => session?.user && loadProfile(session.user.id)
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)