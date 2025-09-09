import { useState, useEffect } from 'react'
import { useRoom } from '../contexts/RoomContext'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { Headphones, Users, Music, Radio, Wifi, WifiOff } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

interface SpotifyDevice {
  id: string
  name: string
  type: string
  is_active: boolean
  is_private_session: boolean
  is_restricted: boolean
}

export default function ViewerInterface() {
  const { user: _user } = useAuth()
  const { isDark } = useTheme()
  const { 
    currentRoom, 
    playbackState, 
    isConnected, 
    joinRoom, 
    leaveRoom,
    getPublicRooms
  } = useRoom()
  
  const [roomId, setRoomId] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [devices, setDevices] = useState<SpotifyDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [isLoadingDevices, setIsLoadingDevices] = useState(false)
  const [publicRooms, setPublicRooms] = useState<any[]>([])
  const [isLoadingPublicRooms, setIsLoadingPublicRooms] = useState(false)
  const [playbackMode, setPlaybackMode] = useState<'device' | 'browser' | 'commands'>('device')
  const [spotifyCommands, setSpotifyCommands] = useState<string>('')

  useEffect(() => {
    if (currentRoom) {
      // Only load devices for authenticated users
      if (_user) {
        loadDevices()
      }
      generateSpotifyCommands()
    }
  }, [currentRoom, playbackState, _user])

  useEffect(() => {
    loadPublicRooms()
  }, [])

  const loadDevices = async () => {
    setIsLoadingDevices(true)
    try {
      const response = await fetch('/api/spotify/devices', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const devicesData = await response.json()
        setDevices(devicesData.devices || [])
        
        // Auto-select active device or first available device
        const activeDevice = devicesData.devices?.find((d: SpotifyDevice) => d.is_active)
        if (activeDevice) {
          setSelectedDeviceId(activeDevice.id)
        } else if (devicesData.devices?.length > 0) {
          setSelectedDeviceId(devicesData.devices[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load devices:', error)
    } finally {
      setIsLoadingDevices(false)
    }
  }

  const generateSpotifyCommands = () => {
    if (!playbackState?.track) return

    const track = playbackState.track
    const artistNames = track.artist || 'Unknown Artist'
    const artistSearch = track.artist || 'Unknown Artist'
    
    const commands = [
      `// Spotify Commands for: ${track.name || 'Unknown Track'} by ${artistNames}`,
      `// Copy and paste these commands in your Spotify app or browser:`,
      ``,
      `// 1. Search for the track:`,
      `spotify:search:${encodeURIComponent((track.name || 'Unknown Track') + ' ' + artistSearch)}`,
      ``,
      `// 2. Direct track link:`,
      `spotify:track:${track.uri.split(':')[2] || 'unknown'}`,
      ``,
      `// 3. Web URL:`,
      `https://open.spotify.com/track/${track.uri.split(':')[2] || 'unknown'}`,
      ``,
      `// 4. Manual search in Spotify:`,
      `Search: "${track.name || 'Unknown Track'}" by ${artistNames}`,
      ``,
      `// 5. Album link (if available):`,
      track.album ? `spotify:album:${track.album}` : '// Album not available',
      track.album ? `https://open.spotify.com/album/${track.album}` : '// Album not available'
    ]

    setSpotifyCommands(commands.join('\n'))
  }

  const copySpotifyCommands = async () => {
    try {
      await navigator.clipboard.writeText(spotifyCommands)
      // You could add a toast notification here
      console.log('Spotify commands copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy commands:', error)
    }
  }

  const loadPublicRooms = async () => {
    setIsLoadingPublicRooms(true)
    try {
      const rooms = await getPublicRooms()
      setPublicRooms(rooms)
    } catch (error) {
      console.error('Failed to load public rooms:', error)
    } finally {
      setIsLoadingPublicRooms(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!roomId.trim()) return
    
    setIsJoining(true)
    try {
      // For device mode, pass the selected device ID
      // For browser and commands mode, pass null or empty string
      const deviceId = playbackMode === 'device' ? selectedDeviceId : undefined
      const success = await joinRoom(roomId.trim(), deviceId)
      if (success) {
        setRoomId('')
      }
    } catch (error) {
      console.error('Failed to join room:', error)
    } finally {
      setIsJoining(false)
    }
  }

  const handleJoinPublicRoom = async (roomId: string) => {
    setIsJoining(true)
    try {
      // For device mode, pass the selected device ID
      // For browser and commands mode, pass null or empty string
      const deviceId = playbackMode === 'device' ? selectedDeviceId : undefined
      const success = await joinRoom(roomId, deviceId)
      if (success) {
        setRoomId('')
      }
    } catch (error) {
      console.error('Failed to join public room:', error)
    } finally {
      setIsJoining(false)
    }
  }

  const handleLeaveRoom = async () => {
    if (!currentRoom) return
    
    setIsLeaving(true)
    try {
      await leaveRoom()
    } catch (error) {
      console.error('Failed to leave room:', error)
    } finally {
      setIsLeaving(false)
    }
  }

  const transferToDevice = async (deviceId: string) => {
    try {
      const response = await fetch('/api/spotify/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ device_id: deviceId })
      })
      
      if (response.ok) {
        setSelectedDeviceId(deviceId)
        // Reload devices to update active status (only for authenticated users)
        if (_user) {
          loadDevices()
        }
      }
    } catch (error) {
      console.error('Failed to transfer playback:', error)
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

  const getDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'computer':
        return '💻'
      case 'smartphone':
        return '📱'
      case 'tablet':
        return '📱'
      case 'tv':
        return '📺'
      case 'speaker':
        return '🔊'
      case 'game_console':
        return '🎮'
      default:
        return '🎵'
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-high-contrast mb-2">Viewer Interface</h1>
        <p className="text-medium-contrast font-medium">
          Join a room and sync your Spotify playback with the host
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column - Room Management */}
        <div className="space-y-6">
          {/* Join Room */}
          {!currentRoom && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Join a Room</h2>
                <p className="card-description">
                  Enter a room ID to start listening with the host
                </p>
              </div>
              <div className="card-content">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="roomId" className="block text-sm font-semibold text-high-contrast mb-2">
                      Room ID
                    </label>
                    <input
                      id="roomId"
                      type="text"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      placeholder="Enter room ID from the host"
                      className="input"
                      disabled={isJoining}
                    />
                  </div>
                  
                  {/* Playback Mode Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-high-contrast mb-2">
                      Playback Mode
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPlaybackMode('device')}
                        className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                          playbackMode === 'device'
                            ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                            : 'border-surface-tertiary hover:border-primary-400/50 text-primary'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-lg mb-1">🎵</div>
                          <div>Device</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlaybackMode('browser')}
                        className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                          playbackMode === 'browser'
                            ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                            : 'border-surface-tertiary hover:border-primary-400/50 text-primary'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-lg mb-1">🌐</div>
                          <div>Browser</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlaybackMode('commands')}
                        className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                          playbackMode === 'commands'
                            ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                            : 'border-surface-tertiary hover:border-primary-400/50 text-primary'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-lg mb-1">📋</div>
                          <div>Commands</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Device Selection - Only show for device mode */}
                  {playbackMode === 'device' && (
                    <div>
                      <label className="block text-sm font-semibold text-high-contrast mb-2">
                        Select Device
                      </label>
                      {isLoadingDevices ? (
                        <div className="flex items-center justify-center p-4">
                          <LoadingSpinner size="sm" />
                          <span className="ml-2 text-sm text-secondary">Loading devices...</span>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {devices.map((device) => (
                            <div
                              key={device.id}
                              className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                                selectedDeviceId === device.id
                                  ? 'border-primary-500 bg-primary-500/10'
                                  : 'border-surface-tertiary hover:border-primary-400/50'
                              }`}
                              onClick={() => setSelectedDeviceId(device.id)}
                            >
                              <span className="text-2xl mr-3">{getDeviceIcon(device.type)}</span>
                              <div className="flex-1">
                                <p className="font-medium text-primary">{device.name}</p>
                                <p className="text-sm text-secondary capitalize">{device.type}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                {device.is_active && (
                                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                                )}
                                {device.is_private_session && (
                                  <span className="text-xs text-yellow-600 bg-yellow-500/20 px-2 py-1 rounded">
                                    Private
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Browser Mode Info */}
                  {playbackMode === 'browser' && (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <div className="text-blue-400 text-xl">🌐</div>
                        <div className="flex-1">
                          <h4 className="font-medium text-blue-400 mb-1">Browser Playback</h4>
                          <p className="text-sm text-secondary mb-3">
                            Since Spotify doesn't allow direct streaming to guests, you can play the same song on YouTube or other platforms.
                          </p>
                          {playbackState?.track && (
                            <div className="space-y-2">
                              <button
                                onClick={() => {
                                  const trackName = playbackState.track?.name || 'Unknown Track'
                                  const artistName = playbackState.track?.artist || 'Unknown Artist'
                                  const searchQuery = encodeURIComponent(`${trackName} ${artistName}`)
                                  window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank')
                                }}
                                className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                              >
                                <span>🎵</span>
                                <span>Play on YouTube</span>
                              </button>
                              <button
                                onClick={() => {
                                  const trackName = playbackState.track?.name || 'Unknown Track'
                                  const artistName = playbackState.track?.artist || 'Unknown Artist'
                                  const searchQuery = encodeURIComponent(`${trackName} ${artistName}`)
                                  window.open(`https://music.apple.com/search?term=${searchQuery}`, '_blank')
                                }}
                                className="w-full bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                              >
                                <span>🎧</span>
                                <span>Play on Apple Music</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Commands Mode Info */}
                  {playbackMode === 'commands' && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <div className="text-green-400 text-xl">📋</div>
                        <div>
                          <h4 className="font-medium text-green-400 mb-1">Copy Commands</h4>
                          <p className="text-sm text-secondary">
                            Copy Spotify commands to manually play the same track in your Spotify app.
                            Commands will be generated when you join a room with active playback.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleJoinRoom}
                    disabled={!!(isJoining || !roomId.trim() || (playbackMode === 'device' && _user && !selectedDeviceId))}
                    className="btn-primary w-full"
                  >
                    {isJoining ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Joining Room...
                      </>
                    ) : (
                      <>
                        <Headphones className="w-4 h-4 mr-2" />
                        Join Room
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Public Rooms */}
          {!currentRoom && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Public Rooms</h2>
                <p className="card-description">
                  Join any of these active public rooms
                </p>
              </div>
              <div className="card-content">
                {isLoadingPublicRooms ? (
                  <div className="flex items-center justify-center p-4">
                    <LoadingSpinner size="sm" />
                    <span className={`ml-2 text-sm transition-colors duration-200 ${
                      isDark ? 'text-slate-300' : 'text-gray-600'
                    }`}>Loading public rooms...</span>
                  </div>
                ) : publicRooms.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {publicRooms.map((room) => (
                      <div
                        key={room.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-surface-tertiary hover:border-primary-400/50 transition-colors"
                      >
                        <div className="flex-1">
                          <h4 className={`font-medium transition-colors duration-200 ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>{room.name}</h4>
                          <p className={`text-sm transition-colors duration-200 ${
                            isDark ? 'text-slate-300' : 'text-gray-600'
                          }`}>
                            Host: {room.host_name} • {room.member_count} member{room.member_count !== 1 ? 's' : ''}
                          </p>
                          {room.description && (
                            <p className={`text-xs mt-1 transition-colors duration-200 ${
                              isDark ? 'text-slate-400' : 'text-gray-500'
                            }`}>{room.description}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            room.is_active 
                              ? 'bg-green-500/20 text-green-600' 
                              : 'bg-yellow-500/20 text-yellow-600'
                          }`}>
                            {room.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            onClick={() => handleJoinPublicRoom(room.id)}
                            disabled={!!(isJoining || (playbackMode === 'device' && _user && !selectedDeviceId))}
                            className="btn-primary btn-sm"
                          >
                            {isJoining ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <>
                                <Headphones className="w-4 h-4 mr-1" />
                                Join
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className={`w-12 h-12 mx-auto mb-3 transition-colors duration-200 ${
                      isDark ? 'text-slate-500' : 'text-gray-400'
                    }`} />
                    <p className={`transition-colors duration-200 ${
                      isDark ? 'text-slate-400' : 'text-gray-500'
                    }`}>No public rooms available</p>
                    <p className={`text-sm mt-1 transition-colors duration-200 ${
                      isDark ? 'text-slate-500' : 'text-gray-400'
                    }`}>
                      Check back later or ask a host to create a public room
                    </p>
                  </div>
                )}
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
                  <div className="flex items-center justify-between p-3 status-section rounded-lg">
                    <span className="text-sm status-label">Status</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      currentRoom.is_active 
                        ? 'bg-green-500/20 text-green-600' 
                        : 'bg-yellow-500/20 text-yellow-600'
                    }`}>
                      {currentRoom.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Member Count */}
                  <div className="flex items-center justify-between p-3 status-section rounded-lg">
                    <span className="text-sm status-label">Members</span>
                    <span className="flex items-center text-sm text-medium-contrast font-medium">
                      <Users className="w-4 h-4 mr-1" />
                      {currentRoom.member_count}
                    </span>
                  </div>

                  {/* Connection Status */}
                  <div className="flex items-center justify-between p-3 status-section rounded-lg">
                    <span className="text-sm status-label">Connection</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isConnected 
                        ? 'bg-green-500/20 text-green-600' 
                        : 'bg-red-500/20 text-red-600'
                    }`}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>

                  {/* Current Device */}
                  {playbackMode === 'device' && (
                    <div className="p-3 status-section rounded-lg">
                      <p className="text-sm status-label mb-2">Current Device</p>
                      {devices.find(d => d.id === selectedDeviceId) && (
                        <div className="flex items-center">
                          <span className="text-2xl mr-2">
                            {getDeviceIcon(devices.find(d => d.id === selectedDeviceId)!.type)}
                          </span>
                          <span className="text-sm text-medium-contrast font-medium">
                            {devices.find(d => d.id === selectedDeviceId)!.name}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Spotify Commands */}
                  {playbackMode === 'commands' && spotifyCommands && (
                    <div className="p-3 status-section rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm status-label">Spotify Commands</p>
                        <button
                          onClick={copySpotifyCommands}
                          className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded hover:bg-green-500/30 transition-colors"
                        >
                          Copy All
                        </button>
                      </div>
                      <div className="bg-black/20 rounded p-3 max-h-40 overflow-y-auto">
                        <pre className="text-xs text-medium-contrast whitespace-pre-wrap font-mono">
                          {spotifyCommands}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Browser Playback Status */}
                  {playbackMode === 'browser' && (
                    <div className="p-3 status-section rounded-lg">
                      <p className="text-sm status-label mb-2">Browser Playback</p>
                      <div className="flex items-center">
                        <span className="text-2xl mr-2">🌐</span>
                        <span className="text-sm text-medium-contrast font-medium">
                          {playbackState?.track ? 'Click buttons above to play on YouTube/Apple Music' : 'Waiting for host to start music'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={handleLeaveRoom}
                      disabled={isLeaving}
                      className="btn-outline flex-1"
                    >
                      {isLeaving ? (
                        <>
                          <LoadingSpinner size="sm" />
                          Leaving...
                        </>
                      ) : (
                        <>
                          <Radio className="w-4 h-4 mr-2" />
                          Leave Room
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Device Management */}
          {currentRoom && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Device Management</h2>
                <p className="card-description">
                  Switch between your available Spotify devices
                </p>
              </div>
              <div className="card-content">
                <div className="space-y-3">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className={`flex items-center p-3 rounded-lg border transition-colors ${
                        selectedDeviceId === device.id
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-surface-tertiary hover:border-primary-400/50'
                      }`}
                    >
                      <span className="text-2xl mr-3">{getDeviceIcon(device.type)}</span>
                      <div className="flex-1">
                        <p className="font-medium text-primary">{device.name}</p>
                        <p className="text-sm text-secondary capitalize">{device.type}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {device.is_active && (
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                        )}
                        <button
                          onClick={() => transferToDevice(device.id)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            selectedDeviceId === device.id
                              ? 'bg-primary-500 text-white'
                              : 'bg-surface-tertiary text-primary hover:bg-primary-500 hover:text-white'
                          }`}
                        >
                          {selectedDeviceId === device.id ? 'Active' : 'Use'}
                        </button>
                      </div>
                    </div>
                  ))}
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
                Current track from the host
              </p>
            </div>
            <div className="card-content">
              {playbackState && playbackState.track ? (
                <div className="space-y-4">
                  {/* Album Art */}
                  <div className="flex justify-center">
                    <img
                      src={playbackState.track?.album_art_url || '/placeholder-album.png'}
                      alt="Album Art"
                      className="w-32 h-32 rounded-lg object-cover shadow-lg"
                    />
                  </div>

                  {/* Track Info */}
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-high-contrast mb-2">
                      {playbackState.track?.name || 'Unknown Track'}
                    </h3>
                    <p className="text-secondary mb-1">
                      {playbackState.track?.artist || 'Unknown Artist'}
                    </p>
                    <p className="text-sm text-tertiary">
                      {playbackState.track?.album || 'Unknown Album'}
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
                    <div className="flex justify-between text-sm text-secondary">
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
                  <Music className="w-16 h-16 text-tertiary mx-auto mb-4" />
                  <p className="text-tertiary">
                    No track currently playing
                  </p>
                  <p className="text-sm text-tertiary mt-1">
                    Wait for the host to start playing music
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sync Status */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Sync Status</h2>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 status-section rounded-lg">
                  <span className="text-sm status-label">Connection</span>
                  <div className="flex items-center space-x-2">
                    {isConnected ? (
                      <>
                        <Wifi className="w-4 h-4 text-green-500" />
                        <span className="text-green-600 text-sm font-medium">Connected</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-4 h-4 text-red-500" />
                        <span className="text-red-600 text-sm font-medium">Disconnected</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 status-section rounded-lg">
                  <span className="text-sm status-label">Room Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    currentRoom?.is_active 
                      ? 'bg-green-500/20 text-green-600' 
                      : 'bg-yellow-500/20 text-yellow-600'
                  }`}>
                    {currentRoom?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 status-section rounded-lg">
                  <span className="text-sm status-label">Sync Quality</span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary-500/20 text-primary-600">
                    {isConnected && currentRoom?.is_active ? 'Excellent' : 'Waiting'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Getting Started</h2>
            </div>
            <div className="card-content">
              <div className="space-y-3 text-sm text-secondary">
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p>Get a room ID from the host</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p>Select your preferred Spotify device</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p>Join the room and start syncing</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p>Your playback will automatically sync</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
