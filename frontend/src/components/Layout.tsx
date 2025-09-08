import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { LogOut, User, Sun, Moon } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth()
  const { toggleTheme, isDark } = useTheme()

  return (
    <div className="min-h-screen bg-primary transition-colors duration-300">
      {/* Navigation */}
      <nav className="border-b border-primary shadow-sm surface-primary transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <span className="text-xl font-bold text-primary transition-colors duration-300">
                TuneWith<span className="text-primary-600">Me</span>
              </span>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="/dashboard" className="text-medium-contrast hover-text-contrast transition-colors duration-200">
                Dashboard
              </a>
              <a href="/viewer" className="text-medium-contrast hover-text-contrast transition-colors duration-200">
                Viewer
              </a>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="hidden md:flex items-center space-x-2 text-sm text-medium-contrast">
                  <User className="w-4 h-4" />
                  <span className="font-semibold text-high-contrast">{user.display_name}</span>
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                    {user.role}
                  </span>
                </div>
              ) : (
                <div className="hidden md:flex items-center space-x-2 text-sm text-medium-contrast">
                  <User className="w-4 h-4" />
                  <span className="font-medium text-primary">Anonymous User</span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium surface-tertiary text-tertiary">
                    Viewer
                  </span>
                </div>
              )}
              
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-secondary hover:text-primary hover:surface-secondary transition-all duration-200"
                title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              {user && (
                <button
                  onClick={logout}
                  className="p-2 rounded-lg text-secondary hover:text-primary hover:surface-secondary transition-all duration-200"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
