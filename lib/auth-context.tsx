'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface User {
  id: string
  email: string
  name: string
  role?: string
  subscription_type?: string
  onboarding_completed?: boolean
  [key: string]: any
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('sc_token')
      if (!token) {
        setUser(null)
        setLoading(false)
        return
      }

      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        // 토큰 만료 등
        localStorage.removeItem('sc_token')
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  const signOut = async () => {
    localStorage.removeItem('sc_token')
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    window.location.href = '/login'
  }

  const refreshUser = async () => {
    await fetchUser()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
