import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import LandingPage from './pages/LandingPage'
import HostDashboard from './pages/HostDashboard'
import ViewerInterface from './pages/ViewerInterface'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          user && user.role === 'host' ? (
            <Layout>
              <HostDashboard />
            </Layout>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      
      <Route
        path="/viewer"
        element={
          user && user.role === 'viewer' ? (
            <Layout>
              <ViewerInterface />
            </Layout>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      
      <Route
        path="/room/:roomId"
        element={
          user ? (
            <Layout>
              {user.role === 'host' ? <HostDashboard /> : <ViewerInterface />}
            </Layout>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      
      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
