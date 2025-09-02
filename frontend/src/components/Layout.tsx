import { useAuth } from '../contexts/AuthContext'
import { LogOut, User, Settings } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Navigation */}
      <nav className="bg-surface-primary border-b border-surface-tertiary/20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <span className="text-xl font-bold text-surface-primary">
                TuneWith<span className="gradient-text">Me</span>
              </span>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="/dashboard" className="text-surface-primary/70 hover:text-surface-primary transition-colors">
                Dashboard
              </a>
              <a href="/viewer" className="text-surface-primary/70 hover:text-surface-primary transition-colors">
                Viewer
              </a>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 text-sm text-surface-primary/70">
                <User className="w-4 h-4" />
                <span>{user?.display_name}</span>
                <span className="px-2 py-1 bg-primary-500/20 text-primary-600 rounded-full text-xs font-medium">
                  {user?.role}
                </span>
              </div>
              
              <button
                onClick={logout}
                className="btn-ghost text-surface-primary/70 hover:text-surface-primary"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
