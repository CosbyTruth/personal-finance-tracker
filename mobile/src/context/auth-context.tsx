import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { sessionStorage } from '@/lib/storage'
import type { User } from '@/types/api'

type Credentials = { email: string; password: string }
type AuthContextValue = {
  user: User | null
  token: string | null
  ready: boolean
  signIn: (credentials: Credentials) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    sessionStorage.get().then(async (savedToken) => {
      if (!savedToken) return
      try {
        const response = await api<{ user: User }>('/api/auth/me', { token: savedToken })
        setToken(savedToken)
        setUser(response.user)
      } catch {
        await sessionStorage.clear()
      }
    }).finally(() => setReady(true))
  }, [])

  const signIn = useCallback(async (credentials: Credentials) => {
    const response = await api<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    if (!response.token) throw new Error('The API did not issue a mobile session. Deploy the latest server changes.')
    await sessionStorage.set(response.token)
    setToken(response.token)
    setUser(response.user)
  }, [])

  const signOut = useCallback(async () => {
    if (token) await api('/api/auth/logout', { method: 'POST', token }).catch(() => {})
    await sessionStorage.clear()
    setToken(null)
    setUser(null)
  }, [token])

  const value = useMemo(() => ({ user, token, ready, signIn, signOut }), [user, token, ready, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
