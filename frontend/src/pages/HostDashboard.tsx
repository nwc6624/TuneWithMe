import { useState } from 'react'
import { useRoom } from '../contexts/RoomContext'
import { useAuth } from '../contexts/AuthContext'
import { Play, Pause, Square, Copy, ExternalLink, Music, Users, Radio } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function HostDashboard() {
  const { user } = useAuth()
  const { 
    currentRoom, 
    playbackState, 
    isConnected, 
    createRoom, 
    startSharing, 
    stopSharing 
  } = useRoom()
  
  const [roomName, setRoomName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)

  const handleCreateRoom = async () => {
    if (!roomName.trim()) return
    
    setIsCreating(true)
    try {
      const roomId = await createRoom(roomName.trim())
      if (roomId) {
        setRoomName('')
      }
    } catch (error) {
      console.error('Failed to create room:', error)
    } finally {
      setIsCreating(false)
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

  const getOverlayUrl = () => {
    if (currentRoom) {
      return `${window.location.origin}/overlay/${currentRoom.id}`
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
    if (!playbackState || !playbackState.duration_ms) return 0
    return (playbackState.position_ms / playbackState.duration_ms) * 100
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Host Dashboard</h1>
        <p className="text-surface-primary/70">
          Welcome back, {user?.display_name}! Create a room and start sharing your music.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column - Room Management */}
        <div className="space-y-6">
          {/* Create Room */}
          {!currentRoom && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Create a New Room</h2>
                <p className="card-description">
                  Start a new listening session and invite others to join
                </p>
              </div>
              <div className="card-content">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="roomName" className="block text-sm font-medium text-surface-primary mb-2">
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

          {/* Current Room */}
          {currentRoom && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Current Room</h2>
                <p className="card-description">
                  Room ID: {currentRoom.id}
                </p>
              </div>
              <div className="card-content">
                <div className="space-y-4">
                  {/* Room Status */}
                  <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                    <span className="text-sm font-medium">Status</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      currentRoom.is_active 
                        ? 'bg-green-500/20 text-green-600' 
                        : 'bg-yellow-500/20 text-yellow-600'
                    }`}>
                      {currentRoom.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Member Count */}
                  <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                    <span className="text-sm font-medium">Members</span>
                    <span className="flex items-center text-sm text-surface-primary/70">
                      <Users className="w-4 h-4 mr-1" />
                      {currentRoom.member_count}
                    </span>
                  </div>

                  {/* Connection Status */}
                  <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                    <span className="text-sm font-medium">Connection</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isConnected 
                        ? 'bg-green-500/20 text-green-600' 
                        : 'bg-red-500/20 text-red-600'
                    }`}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    {!currentRoom.is_active ? (
                      <button
                        onClick={handleStartSharing}
                        disabled={isStarting}
                        className="btn-primary flex-1"
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
                        className="btn-outline flex-1"
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
                  </div>

                  {/* Room ID Copy */}
                  <div className="flex space-x-2">
                    <button
                      onClick={copyRoomId}
                      className="btn-outline flex-1"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Room ID
                    </button>
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
                  <div className="p-3 bg-surface-secondary rounded-lg">
                    <p className="text-sm text-surface-primary/70 break-all">
                      {getOverlayUrl()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={copyOverlayUrl}
                      className="btn-outline flex-1"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy URL
                    </button>
                    <a
                      href={getOverlayUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline"
                    >
                      <ExternalLink className="w-4 h-4" />
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
              <h2 className="card-title">Now Playing</h2>
              <p className="card-description">
                Current track information and playback status
              </p>
            </div>
            <div className="card-content">
              {playbackState && playbackState.track ? (
                <div className="space-y-4">
                  {/* Album Art */}
                  <div className="flex justify-center">
                    <img
                      src={playbackState.track.album_art_url}
                      alt="Album Art"
                      className="w-32 h-32 rounded-lg object-cover shadow-lg"
                    />
                  </div>

                  {/* Track Info */}
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-surface-primary mb-2">
                      {playbackState.track.name}
                    </h3>
                    <p className="text-surface-primary/70 mb-1">
                      {playbackState.track.artist}
                    </p>
                    <p className="text-sm text-surface-primary/50">
                      {playbackState.track.album}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="w-full bg-surface-tertiary rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${getProgressPercent()}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm text-surface-primary/70">
                      <span>{formatTime(playbackState.position_ms)}</span>
                      <span>{formatTime(playbackState.duration_ms)}</span>
                    </div>
                  </div>

                  {/* Playback Status */}
                  <div className="flex items-center justify-center">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      playbackState.is_playing
                        ? 'bg-green-500/20 text-green-600'
                        : 'bg-yellow-500/20 text-yellow-600'
                    }`}>
                      {playbackState.is_playing ? 'Playing' : 'Paused'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Music className="w-16 h-16 text-surface-primary/30 mx-auto mb-4" />
                  <p className="text-surface-primary/50">
                    No track currently playing
                  </p>
                  <p className="text-sm text-surface-primary/30 mt-1">
                    Start playing music on Spotify to see it here
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Getting Started</h2>
            </div>
            <div className="card-content">
              <div className="space-y-3 text-sm text-surface-primary/70">
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p>Create a room and start sharing</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p>Play music normally on Spotify</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p>Share the room ID with viewers</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p>Add the overlay URL to OBS</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
