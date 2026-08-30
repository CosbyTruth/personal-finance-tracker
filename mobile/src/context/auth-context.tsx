import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { sessionStorage } from '@/lib/storage'
import type { User } from '@/types/api'

type Credentials = { email: string; password: string }
type Registration = Credentials & { name: string }
type AuthContextValue = {
  user: User | null
  token: string | null
  ready: boolean
  signIn: (credentials: Credentials) => Promise<void>
  register: (details: Registration) => Promise<void>
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
    const response = await api<{ user: User; token: string }>('/api/auth/mobile/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    if (!response.token) throw new Error('The Kora API did not return a secure mobile session. Restart the API and try again.')
    await sessionStorage.set(response.token)
    setToken(response.token)
    setUser(response.user)
  }, [])

  const register = useCallback(async (details: Registration) => {
    const response = await api<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(details),
    })
    if (!response.token) throw new Error('The Kora API did not return a secure mobile session. Restart the API and try again.')
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

  const value = useMemo(() => ({ user, token, ready, signIn, register, signOut }), [user, token, ready, signIn, register, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
