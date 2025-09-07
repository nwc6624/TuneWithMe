import { useState, useEffect } from 'react'
import { useRoom } from '../contexts/RoomContext'
import { useAuth } from '../contexts/AuthContext'
import { Play, Pause, Copy, ExternalLink, Music, Users, Radio, SkipBack, SkipForward, QrCode } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import QRCodeModal from '../components/QRCodeModal'

export default function HostDashboard() {
  const { user } = useAuth()
  const { 
    currentRoom, 
    playbackState, 
    isConnected, 
    createRoom, 
    joinRoom,
    joinRoomByCode,
    startSharing, 
    stopSharing 
  } = useRoom()
  
  const [roomName, setRoomName] = useState('')
  const [roomDescription, setRoomDescription] = useState('')
  const [roomVisibility, setRoomVisibility] = useState<'public' | 'private'>('private')
  const [joinRoomId, setJoinRoomId] = useState('')
  const [joinRoomCode, setJoinRoomCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [isJoiningByCode, setIsJoiningByCode] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [currentPlayback, setCurrentPlayback] = useState<any>(null)
  const [isLoadingPlayback, setIsLoadingPlayback] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0)
  const [showQRModal, setShowQRModal] = useState(false)

  const handleCreateRoom = async () => {
    if (!roomName.trim()) return
    
    setIsCreating(true)
    try {
      const roomId = await createRoom(
        roomName.trim(), 
        roomVisibility, 
        roomDescription.trim() || undefined
      )
      if (roomId) {
        setRoomName('')
        setRoomDescription('')
        setRoomVisibility('private')
      }
    } catch (error) {
      console.error('Failed to create room:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!joinRoomId.trim()) return
    
    setIsJoining(true)
    try {
      const success = await joinRoom(joinRoomId.trim())
      if (success) {
        setJoinRoomId('')
      }
    } catch (error) {
      console.error('Failed to join room:', error)
    } finally {
      setIsJoining(false)
    }
  }

  const handleJoinRoomByCode = async () => {
    if (!joinRoomCode.trim()) return
    
    setIsJoiningByCode(true)
    try {
      const success = await joinRoomByCode(joinRoomCode.trim())
      if (success) {
        setJoinRoomCode('')
      }
    } catch (error) {
      console.error('Failed to join room by code:', error)
    } finally {
      setIsJoiningByCode(false)
    }
  }

  const handleStartSharing = async () => {
    if (!currentRoom) return
    
    setIsStarting(true)
    try {
      await startSharing()
    } catch (error) {
      console.error('Failed to start sharing:', error)
    } finally {
      setIsStarting(false)
    }
  }

  const handleStopSharing = async () => {
    if (!currentRoom) return
    
    setIsStopping(true)
    try {
      await stopSharing()
    } catch (error) {
      console.error('Failed to stop sharing:', error)
    } finally {
      setIsStopping(false)
    }
  }

  const copyRoomId = () => {
    if (currentRoom) {
      navigator.clipboard.writeText(currentRoom.id)
    }
  }

  const copyRoomCode = () => {
    if (currentRoom?.room_code) {
      navigator.clipboard.writeText(currentRoom.room_code)
    }
  }

  const getOverlayUrl = () => {
    if (currentRoom) {
      // Use the backend URL for the overlay, not the frontend
      const backendUrl = process.env.NODE_ENV === 'production' 
        ? `https://${window.location.host}`
        : 'http://localhost:3001';
      return `${backendUrl}/overlay/${currentRoom.id}`
    }
    return ''
  }

  const copyOverlayUrl = () => {
    const url = getOverlayUrl()
    if (url) {
      navigator.clipboard.writeText(url)
    }
  }

  const formatTime = (ms: number) => {
    if (!ms || ms <= 0) return '0:00'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getProgressPercent = () => {
    if (!currentPlayback || !currentPlayback.duration_ms) return 0
    return (currentPlayback.position_ms / currentPlayback.duration_ms) * 100
  }

  // Smooth progress bar updates
  const [smoothProgress, setSmoothProgress] = useState(0)
  
  useEffect(() => {
    if (currentPlayback?.is_playing && currentPlayback.duration_ms > 0) {
      const targetProgress = getProgressPercent()
      setSmoothProgress(targetProgress)
      
      // Update progress smoothly while playing
      const interval = setInterval(() => {
        setSmoothProgress(() => {
          const currentTime = Date.now()
          const elapsed = (currentTime - lastUpdateTime) / 1000 // seconds since last update
          const newPosition = currentPlayback.position_ms + (elapsed * 1000) // approximate new position
          const newProgress = (newPosition / currentPlayback.duration_ms) * 100
          return Math.min(newProgress, 100)
        })
      }, 100) // Update every 100ms for smooth animation
      
      return () => clearInterval(interval)
    } else {
      setSmoothProgress(getProgressPercent())
    }
  }, [currentPlayback?.position_ms, currentPlayback?.is_playing, currentPlayback?.duration_ms, lastUpdateTime])

  // Audio Control Handlers
  const handlePreviousTrack = async () => {
    try {
      const response = await fetch('/auth/spotify/previous', {
        method: 'POST',
        credentials: 'include'
      })
      if (response.ok) {
        // Refresh playback state
        fetchCurrentPlayback()
      }
    } catch (error) {
      console.error('Failed to go to previous track:', error)
    }
  }

  const handleNextTrack = async () => {
    try {
      const response = await fetch('/auth/spotify/next', {
        method: 'POST',
        credentials: 'include'
      })
      if (response.ok) {
        // Refresh playback state
        fetchCurrentPlayback()
      }
    } catch (error) {
      console.error('Failed to go to next track:', error)
    }
  }

  const handlePlayPause = async () => {
    try {
      const endpoint = currentPlayback?.is_playing ? '/auth/spotify/pause' : '/auth/spotify/play'
      const response = await fetch(endpoint, {
        method: 'PUT',
        credentials: 'include'
      })
      if (response.ok) {
        // Refresh playback state
        fetchCurrentPlayback()
      }
    } catch (error) {
      console.error('Failed to toggle play/pause:', error)
    }
  }

  const fetchCurrentPlayback = async (isBackgroundUpdate = false) => {
    // Don't show loading spinner for background updates to prevent flickering
    if (!isBackgroundUpdate) {
      setIsLoadingPlayback(true)
    }
    
    try {
      const response = await fetch('/auth/spotify/currently-playing', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Current playback data:', data)
        
        // Only update if we have new data or it's the initial load
        if (data && data.track && (!currentPlayback || data.track.uri !== currentPlayback.track?.uri || isInitialLoad)) {
          setCurrentPlayback(data)
          setLastUpdateTime(Date.now())
          setIsInitialLoad(false)
        } else if (data && currentPlayback) {
          // Update position and playing status without changing the track
          setCurrentPlayback((prev: any) => ({
            ...prev,
            is_playing: data.is_playing,
            position_ms: data.position_ms,
            duration_ms: data.duration_ms
          }))
        }
      } else {
        console.error('Failed to fetch current playback')
        if (!isBackgroundUpdate) {
          setCurrentPlayback(null)
        }
      }
    } catch (error) {
      console.error('Error fetching current playback:', error)
      if (!isBackgroundUpdate) {
        setCurrentPlayback(null)
      }
    } finally {
      if (!isBackgroundUpdate) {
        setIsLoadingPlayback(false)
      }
    }
  }

  // Fetch current playback with smart polling
  useEffect(() => {
    fetchCurrentPlayback()
    
    // Use different intervals based on playback state
    const getPollingInterval = () => {
      if (currentPlayback?.is_playing) {
        return 2000 // Poll every 2 seconds when playing
      }
      return 5000 // Poll every 5 seconds when paused
    }
    
    const interval = setInterval(() => {
      fetchCurrentPlayback(true) // Background update
    }, getPollingInterval())
    
    return () => clearInterval(interval)
  }, [currentPlayback?.is_playing])

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Host Dashboard</h1>
        <p className="text-gray-600">
          Welcome back, {user?.display_name}! Create a room and start sharing your music.
        </p>
      </div>

      {/* Current Spotify Playback */}
      <div className="card mb-6">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="card-title text-gray-900">Current Spotify Playback</h2>
              <p className="card-description text-gray-600">
                Your current music status from Spotify
              </p>
            </div>
            {isLoadingPlayback && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>Updating...</span>
              </div>
            )}
          </div>
        </div>
        <div className="card-content">
          {currentPlayback && currentPlayback.track ? (
            <div className="space-y-4">
              {/* Track Info */}
              <div className="flex items-center space-x-4">
                {currentPlayback.track.album_art_url && (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-200">
                    <img 
                      src={currentPlayback.track.album_art_url} 
                      alt="Album Art"
                      className="w-full h-full object-cover transition-opacity duration-200"
                      onLoad={(e) => {
                        e.currentTarget.style.opacity = '1'
                      }}
                      onError={(e) => {
                        e.currentTarget.style.opacity = '0'
                      }}
                      style={{ opacity: 0 }}
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {currentPlayback.track.name}
                  </h3>
                  <p className="text-gray-600">
                    {currentPlayback.track.artist} • {currentPlayback.track.album}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  currentPlayback.is_playing 
                    ? 'bg-green-500/20 text-green-700' 
                    : 'bg-yellow-500/20 text-yellow-700'
                }`}>
                  {currentPlayback.is_playing ? 'Playing' : 'Paused'}
                </div>
              </div>
              
              {/* Progress Bar */}
              {currentPlayback.duration_ms > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{formatTime(currentPlayback.position_ms)}</span>
                    <span>{formatTime(currentPlayback.duration_ms)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-100 ease-linear"
                      style={{ width: `${smoothProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Music className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">
                {currentPlayback?.is_playing === false 
                  ? 'No music currently playing' 
                  : 'Start playing music in Spotify to see it here'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column - Room Management */}
        <div className="space-y-6">
          {/* Create Room */}
          {!currentRoom && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title text-gray-900">Create a New Room</h2>
                <p className="card-description text-gray-600">
                  Start a new listening session and invite others to join
                </p>
              </div>
              <div className="card-content">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-2">
                      Room Name (Optional)
                    </label>
                    <input
                      id="roomName"
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="My Awesome Playlist"
                      className="input"
                      disabled={isCreating}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="roomDescription" className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      id="roomDescription"
                      value={roomDescription}
                      onChange={(e) => setRoomDescription(e.target.value)}
                      placeholder="What kind of music are you playing?"
                      className="input min-h-[80px] resize-none"
                      disabled={isCreating}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Room Visibility
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="visibility"
                          value="private"
                          checked={roomVisibility === 'private'}
                          onChange={(e) => setRoomVisibility(e.target.value as 'public' | 'private')}
                          className="mr-2"
                          disabled={isCreating}
                        />
                        <span className="text-sm text-gray-700">
                          Private - Requires room code to join
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="visibility"
                          value="public"
                          checked={roomVisibility === 'public'}
                          onChange={(e) => setRoomVisibility(e.target.value as 'public' | 'private')}
                          className="mr-2"
                          disabled={isCreating}
                        />
                        <span className="text-sm text-gray-700">
                          Public - Visible to everyone
                        </span>
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={handleCreateRoom}
                    disabled={isCreating || !roomName.trim()}
                    className="btn-primary w-full"
                  >
                    {isCreating ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Creating Room...
                      </>
                    ) : (
                      <>
                        <Radio className="w-4 h-4 mr-2" />
                        Create Room
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Join Room */}
          {!currentRoom && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title text-gray-900">Join a Room</h2>
                <p className="card-description text-gray-600">
                  Join someone else's listening session
                </p>
                <div className="mt-2">
                  <a 
                    href="/public-rooms" 
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Browse public rooms →
                  </a>
                </div>
              </div>
              <div className="card-content">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="joinRoomId" className="block text-sm font-medium text-gray-700 mb-2">
                      Room ID
                    </label>
                    <input
                      id="joinRoomId"
                      type="text"
                      value={joinRoomId}
                      onChange={(e) => setJoinRoomId(e.target.value)}
                      placeholder="Enter room ID here"
                      className="input"
                      disabled={isJoining}
                    />
                  </div>
                  <button
                    onClick={handleJoinRoom}
                    disabled={isJoining || !joinRoomId.trim()}
                    className="btn-outline w-full"
                  >
                    {isJoining ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Joining Room...
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4 mr-2" />
                        Join Room
                      </>
                    )}
                  </button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">or</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="joinRoomCode" className="block text-sm font-medium text-gray-700 mb-2">
                      Room Code
                    </label>
                    <input
                      id="joinRoomCode"
                      type="text"
                      value={joinRoomCode}
                      onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                      placeholder="Enter room code (e.g., ABC123)"
                      className="input font-mono text-center text-lg tracking-wider"
                      disabled={isJoiningByCode}
                      maxLength={6}
                    />
                  </div>
                  <button
                    onClick={handleJoinRoomByCode}
                    disabled={isJoiningByCode || !joinRoomCode.trim()}
                    className="btn-outline w-full"
                  >
                    {isJoiningByCode ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Joining Room...
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4 mr-2" />
                        Join with Code
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Current Room */}
          {currentRoom && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title text-gray-900">{currentRoom.name || 'Current Room'}</h2>
                <p className="card-description text-gray-600">
                  {currentRoom.description && (
                    <span className="block mb-1">{currentRoom.description}</span>
                  )}
                  <span className="text-xs text-gray-500">
                    {currentRoom.visibility === 'public' ? '🌐 Public Room' : '🔒 Private Room'} • 
                    ID: {currentRoom.id}
                  </span>
                </p>
              </div>
              <div className="card-content">
                <div className="space-y-4">
                  {/* Room Status */}
                  <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Status</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      currentRoom.is_active 
                        ? 'bg-green-500/20 text-green-700' 
                        : 'bg-yellow-500/20 text-yellow-700'
                    }`}>
                      {currentRoom.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Member Count */}
                  <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Members</span>
                    <span className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-1" />
                      {currentRoom.member_count}
                      {currentRoom.member_count === 1 && (
                        <span className="ml-1 text-xs text-gray-500">(Self)</span>
                      )}
                    </span>
                  </div>

                  {/* Connection Status */}
                  <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Connection</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isConnected 
                        ? 'bg-green-500/20 text-green-700' 
                        : 'bg-red-500/20 text-red-700'
                    }`}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>

                  {/* Centered Action Buttons */}
                  <div className="flex justify-center space-x-3 pt-2">
                    {!currentRoom.is_active ? (
                      <button
                        onClick={handleStartSharing}
                        disabled={isStarting}
                        className="inline-flex items-center justify-center rounded-md bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isStarting ? (
                          <>
                            <LoadingSpinner size="sm" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Start Sharing
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={handleStopSharing}
                        disabled={isStopping}
                        className="inline-flex items-center justify-center rounded-md border border-surface-tertiary bg-transparent hover:bg-surface-secondary px-6 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isStopping ? (
                          <>
                            <LoadingSpinner size="sm" />
                            Stopping...
                          </>
                        ) : (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            Stop Sharing
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={copyRoomId}
                      className="inline-flex items-center justify-center rounded-md border border-surface-tertiary bg-transparent hover:bg-surface-secondary px-6 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Room ID
                    </button>
                    {currentRoom.room_code && (
                      <>
                        <button
                          onClick={copyRoomCode}
                          className="inline-flex items-center justify-center rounded-md border border-surface-tertiary bg-transparent hover:bg-surface-secondary px-6 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Room Code ({currentRoom.room_code})
                        </button>
                        <button
                          onClick={() => setShowQRModal(true)}
                          className="inline-flex items-center justify-center rounded-md border border-surface-tertiary bg-transparent hover:bg-surface-secondary px-6 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                          <QrCode className="w-4 h-4 mr-2" />
                          Show QR Code
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* OBS Overlay */}
          {currentRoom && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">OBS Overlay</h2>
                <p className="card-description">
                  Add this URL to your OBS browser source for a "Now Playing" overlay
                </p>
              </div>
              <div className="card-content">
                <div className="space-y-4">
                  {/* Dimensions Note */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Radio className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">
                        Recommended dimensions: <strong>320 × 110 pixels</strong>
                      </span>
                    </div>
                  </div>
                  
                  {/* URL Display */}
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <p className="text-sm text-gray-600 break-all font-mono">
                      {getOverlayUrl()}
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex justify-center space-x-3">
                    <button
                      onClick={copyOverlayUrl}
                      className="inline-flex items-center justify-center rounded-md border border-surface-tertiary bg-transparent hover:bg-surface-secondary px-6 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy URL
                    </button>
                    <a
                      href={getOverlayUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md border border-surface-tertiary bg-transparent hover:bg-surface-secondary px-6 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Preview
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Current Playback */}
        <div className="space-y-6">
          {/* Current Track */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="card-title text-gray-900">Now Playing</h2>
                  <p className="card-description text-gray-600">
                    Current track information and playback status
                  </p>
                </div>
                {isLoadingPlayback && (
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span>Syncing...</span>
                  </div>
                )}
              </div>
            </div>
            <div className="card-content">
              {currentPlayback && currentPlayback.track ? (
                <div className="space-y-4">
                  {/* Previous Track */}
                  <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-gray-300">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                        <SkipBack className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">
                          Previous Track
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {currentPlayback.previous_track?.name || 'No previous track'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Current Track */}
                  <div className="text-center">
                    {/* Album Art */}
                    <div className="flex justify-center mb-4">
                      <div className="relative w-32 h-32 rounded-lg overflow-hidden shadow-lg bg-gray-200">
                        <img
                          src={currentPlayback.track.album_art_url}
                          alt="Album Art"
                          className="w-full h-full object-cover transition-opacity duration-200"
                          onLoad={(e) => {
                            e.currentTarget.style.opacity = '1'
                          }}
                          onError={(e) => {
                            e.currentTarget.style.opacity = '0'
                          }}
                          style={{ opacity: 0 }}
                        />
                      </div>
                    </div>

                    {/* Track Info */}
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {currentPlayback.track.name}
                    </h3>
                    <p className="text-gray-600 mb-1">
                      {currentPlayback.track.artist}
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      {currentPlayback.track.album}
                    </p>

                    {/* Progress Bar */}
                    <div className="space-y-2 mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-100 ease-linear"
                          style={{ width: `${smoothProgress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{formatTime(currentPlayback.position_ms)}</span>
                        <span>{formatTime(currentPlayback.duration_ms)}</span>
                      </div>
                    </div>

                    {/* Playback Status */}
                    <div className="flex items-center justify-center mb-4">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        currentPlayback.is_playing
                          ? 'bg-green-500/20 text-green-600'
                          : 'bg-yellow-500/20 text-yellow-600'
                      }`}>
                        {currentPlayback.is_playing ? 'Playing' : 'Paused'}
                      </div>
                    </div>

                    {/* Audio Controls - Only for Host */}
                    {currentRoom && currentRoom.is_active && (
                      <div className="border-t pt-4">
                        <p className="text-xs text-gray-500 mb-3">Streamer Controls</p>
                        <div className="flex justify-center space-x-4">
                          <button
                            onClick={handlePreviousTrack}
                            className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                            title="Previous Track"
                          >
                            <SkipBack className="w-5 h-5 text-gray-700" />
                          </button>
                          <button
                            onClick={handlePlayPause}
                            className="p-3 bg-blue-100 hover:bg-blue-200 rounded-full transition-colors"
                            title={playbackState?.is_playing ? 'Pause' : 'Play'}
                          >
                            {playbackState?.is_playing ? (
                              <Pause className="w-5 h-5 text-blue-700" />
                            ) : (
                              <Play className="w-5 h-5 text-blue-700" />
                            )}
                          </button>
                          <button
                            onClick={handleNextTrack}
                            className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                            title="Next Track"
                          >
                            <SkipForward className="w-5 h-5 text-gray-700" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Next Track */}
                  <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-blue-300">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                        <SkipForward className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">
                          Next Track
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {currentPlayback.next_track?.name || 'No next track'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    No track currently playing
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Start playing music on Spotify to see it here
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title text-gray-900">Getting Started</h2>
            </div>
            <div className="card-content">
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <p>Create a room and start sharing</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <p>Play music normally on Spotify</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <p>Share the room ID with viewers</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <p>Add the overlay URL to OBS</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {currentRoom && currentRoom.room_code && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          roomCode={currentRoom.room_code}
          roomName={currentRoom.name}
          roomId={currentRoom.id}
        />
      )}
    </div>
  )
}
