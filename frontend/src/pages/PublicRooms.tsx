import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoom } from '../contexts/RoomContext'
import { useAuth } from '../contexts/AuthContext'
import { Users, Music, Clock, Globe } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

interface PublicRoom {
  id: string
  name: string
  description?: string
  host_name: string
  member_count: number
  created_at: string
}

export default function PublicRooms() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { joinRoom, getPublicRooms } = useRoom()
  
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPublicRooms()
  }, [])

  const loadPublicRooms = async () => {
    setIsLoading(true)
    try {
      const rooms = await getPublicRooms()
      setPublicRooms(rooms)
    } catch (error) {
      console.error('Failed to load public rooms:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinRoom = async (roomId: string) => {
    console.log('=== JOIN ROOM DEBUG START ===')
    console.log('Browser:', navigator.userAgent)
    console.log('Attempting to join room:', roomId)
    console.log('joinRoom function available:', typeof joinRoom)
    console.log('navigate function available:', typeof navigate)
    
    setIsJoining(roomId)
    setError(null)
    try {
      console.log('Calling joinRoom function...')
      const success = await joinRoom(roomId)
      console.log('Join room result:', success)
      if (success) {
        console.log('Room joined successfully, navigating to:', `/room/${roomId}`)
        // Room joined successfully, navigate to the room
        navigate(`/room/${roomId}`)
      } else {
        console.log('Join room failed')
        setError('Failed to join room. Please try again.')
      }
    } catch (error) {
      console.error('Failed to join room:', error)
      console.error('Error details:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      })
      setError(`Failed to join room: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsJoining(null)
      console.log('=== JOIN ROOM DEBUG END ===')
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  // Allow anonymous users to view public rooms

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Public Rooms</h1>
          <p className="text-gray-600">
            Discover and join public listening sessions from other users
          </p>
        </div>

        {/* Refresh Button */}
        <div className="mb-6">
          <button
            onClick={loadPublicRooms}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Loading...</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 mr-2" />
                Refresh Rooms
              </>
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Rooms List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : publicRooms.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No public rooms available</h3>
            <p className="text-gray-600">
              There are currently no active public rooms. Check back later or create your own!
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {publicRooms.map((room) => (
              <div key={room.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 bg-white px-2 py-1 rounded">
                      {room.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2 bg-gray-50 px-2 py-1 rounded">
                      Host: {room.host_name}
                    </p>
                    {room.description && (
                      <p className="text-sm text-gray-700 mb-3 bg-gray-50 px-2 py-1 rounded">
                        {room.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">
                    <Globe className="w-3 h-3 mr-1" />
                    Public
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                    <Users className="w-4 h-4 mr-1" />
                    {room.member_count} {room.member_count === 1 ? 'member' : 'members'}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatTimeAgo(room.created_at)}
                  </div>
                </div>

                <button
                  onClick={() => handleJoinRoom(room.id)}
                  disabled={isJoining === room.id}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isJoining === room.id ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Joining...</span>
                    </>
                  ) : (
                    'Join Room'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
