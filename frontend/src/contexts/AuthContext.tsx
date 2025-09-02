import React, { createContext, useContext, useEffect, useState } from 'react'

interface User {
  user_id: string
  display_name: string
  role: 'host' | 'viewer'
  authenticated: boolean
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (role: 'host' | 'viewer') => void
  logout: () => Promise<void>
  refreshTokens: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Failed to check auth status:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = (role: 'host' | 'viewer') => {
    // Redirect to Spotify OAuth
    window.location.href = `/api/auth/spotify/start?role=${role}`
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      setUser(null)
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  const refreshTokens = async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        // Tokens refreshed successfully
        console.log('Tokens refreshed')
      } else {
        // Refresh failed, redirect to login
        setUser(null)
      }
    } catch (error) {
      console.error('Failed to refresh tokens:', error)
      setUser(null)
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    refreshTokens
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
