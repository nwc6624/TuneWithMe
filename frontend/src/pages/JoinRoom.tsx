import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '../contexts/RoomContext'
import { useAuth } from '../contexts/AuthContext'
import { Users, Music, ArrowLeft, Loader } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function JoinRoom() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { joinRoomByCode, currentRoom } = useRoom()
  
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (code && user && !currentRoom) {
      handleJoinRoom()
    }
  }, [code, user, currentRoom])

  useEffect(() => {
    if (currentRoom) {
      setSuccess(true)
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard')
      }, 2000)
    }
  }, [currentRoom, navigate])

  const handleJoinRoom = async () => {
    if (!code || !user) return
    
    setIsJoining(true)
    setError(null)
    
    try {
      const success = await joinRoomByCode(code.toUpperCase())
      if (!success) {
        setError('Failed to join room. The room code may be invalid or the room may no longer exist.')
      }
    } catch (error) {
      console.error('Failed to join room:', error)
      setError('An error occurred while trying to join the room.')
    } finally {
      setIsJoining(false)
    }
  }

  const handleRetry = () => {
    setError(null)
    handleJoinRoom()
  }

  const handleGoBack = () => {
    navigate('/dashboard')
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please log in</h1>
          <p className="text-gray-600 mb-6">
            You need to be logged in with Spotify to join a room.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <button
            onClick={handleGoBack}
            className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Joining Room</h1>
          <p className="text-gray-600">
            Room Code: <span className="font-mono font-bold">{code?.toUpperCase()}</span>
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {isJoining && (
            <div className="text-center">
              <LoadingSpinner size="lg" />
              <h2 className="text-lg font-semibold text-gray-900 mt-4 mb-2">
                Joining Room...
              </h2>
              <p className="text-gray-600">
                Please wait while we connect you to the room.
              </p>
            </div>
          )}

          {error && (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Failed to Join Room
              </h2>
              <p className="text-gray-600 mb-6">
                {error}
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleRetry}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={handleGoBack}
                  className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
          )}

          {success && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Music className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Successfully Joined!
              </h2>
              <p className="text-gray-600 mb-4">
                You've been added to the room. Redirecting to dashboard...
              </p>
              <div className="flex justify-center">
                <Loader className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            </div>
          )}

          {!isJoining && !error && !success && (
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Ready to Join
              </h2>
              <p className="text-gray-600 mb-6">
                Click the button below to join the room.
              </p>
              <button
                onClick={handleJoinRoom}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Join Room
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">How it works:</h3>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• You'll be connected to the host's Spotify session</li>
            <li>• Music will sync automatically with other listeners</li>
            <li>• You can control playback if the host allows it</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
