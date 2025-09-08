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
    <div className={`min-h-screen transition-colors duration-200 ${
      isDark ? 'bg-slate-900' : 'bg-gray-50'
    }`}>
      {/* Navigation */}
      <nav className={`border-b shadow-sm transition-colors duration-200 ${
        isDark 
          ? 'bg-slate-800 border-slate-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <span className={`text-xl font-bold transition-colors duration-200 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                TuneWith<span className="text-blue-600">Me</span>
              </span>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="/dashboard" className={`transition-colors font-medium ${
                isDark 
                  ? 'text-slate-300 hover:text-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}>
                Dashboard
              </a>
              <a href="/viewer" className={`transition-colors font-medium ${
                isDark 
                  ? 'text-slate-300 hover:text-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}>
                Viewer
              </a>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              {user ? (
                <div className={`hidden md:flex items-center space-x-2 text-sm transition-colors duration-200 ${
                  isDark ? 'text-slate-300' : 'text-gray-600'
                }`}>
                  <User className="w-4 h-4" />
                  <span className="font-medium">{user.display_name}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isDark 
                      ? 'bg-blue-900 text-blue-300' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {user.role}
                  </span>
                </div>
              ) : (
                <div className={`hidden md:flex items-center space-x-2 text-sm transition-colors duration-200 ${
                  isDark ? 'text-slate-300' : 'text-gray-600'
                }`}>
                  <User className="w-4 h-4" />
                  <span className="font-medium">Anonymous User</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isDark 
                      ? 'bg-gray-700 text-gray-300' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    Viewer
                  </span>
                </div>
              )}
              
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-colors duration-200 ${
                  isDark 
                    ? 'text-slate-300 hover:text-white hover:bg-slate-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              {user && (
                <button
                  onClick={logout}
                  className={`p-2 rounded-lg transition-colors duration-200 ${
                    isDark 
                      ? 'text-slate-300 hover:text-white hover:bg-slate-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
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
