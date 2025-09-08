import React, { createContext, useContext, useEffect, useState, useRef } from 'react'

interface PlaybackState {
  track: {
    uri: string
    name: string
    artist: string
    album: string
    duration_ms: number
    album_art_url?: string
    type: 'track' | 'episode' | 'ad' | 'unknown'
    show_name?: string
    publisher?: string
  } | null
  is_playing: boolean
  position_ms: number
  duration_ms: number
  context_uri?: string
  updated_at: number
}

interface Room {
  id: string
  host_user_id: string
  host_name: string
  name: string
  description?: string
  visibility: 'public' | 'private'
  room_code?: string
  created_at: string
  is_active: boolean
  member_count: number
  members: string[]
  is_host?: boolean
}

interface RoomContextType {
  currentRoom: Room | null
  playbackState: PlaybackState | null
  isConnected: boolean
  joinRoom: (roomId: string, deviceId?: string) => Promise<boolean>
  joinRoomByCode: (roomCode: string) => Promise<boolean>
  getPublicRooms: () => Promise<Room[]>
  getMyRooms: () => Promise<Room[]>
  leaveRoom: () => Promise<void>
  createRoom: (name?: string, visibility?: 'public' | 'private', description?: string) => Promise<string | null>
  startSharing: () => Promise<boolean>
  stopSharing: () => Promise<boolean>
  updateRoom: (roomId: string, updates: { name?: string, description?: string, visibility?: 'public' | 'private' }) => Promise<boolean>
  startRoom: (roomId: string) => Promise<boolean>
  stopRoom: (roomId: string) => Promise<boolean>
  deleteRoom: (roomId: string) => Promise<boolean>
  sendControlMessage: (action: string, data: any) => void
}

const RoomContext = createContext<RoomContextType | undefined>(undefined)

export function useRoom() {
  const context = useContext(RoomContext)
  if (context === undefined) {
    throw new Error('useRoom must be used within a RoomProvider')
  }
  return context
}

interface RoomProviderProps {
  children: React.ReactNode
}

export function RoomProvider({ children }: RoomProviderProps) {
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  const connectWebSocket = (roomId: string) => {
    try {
      const wsUrl = process.env.NODE_ENV === 'production' 
        ? `wss://${window.location.host}/ws/rooms/${roomId}`
        : `ws://127.0.0.1:3001/ws/rooms/${roomId}`;
      const ws = new WebSocket(wsUrl)
      
      ws.onopen = () => {
        setIsConnected(true)
        console.log('WebSocket connected')
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleWebSocketMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        console.log('WebSocket disconnected')
        
        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (currentRoom) {
            connectWebSocket(currentRoom.id)
          }
        }, 5000)
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnected(false)
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
    }
  }

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'NOW_PLAYING':
        setPlaybackState(message.payload)
        break
      
      case 'CONTROL':
        // Handle control messages (play, pause, seek, etc.)
        console.log('Control message received:', message.payload)
        break
      
      case 'MEMBER_JOIN':
        // Handle member join
        console.log('Member joined:', message.payload)
        break
      
      case 'MEMBER_LEAVE':
        // Handle member leave
        console.log('Member left:', message.payload)
        break
      
      case 'CONNECTED':
        console.log('Connected to room:', message.payload)
        break
      
      default:
        console.log('Unknown message type:', message.type)
    }
  }

  const createRoom = async (name?: string, visibility?: 'public' | 'private', description?: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name, visibility, description })
      })

      if (response.ok) {
        const data = await response.json()
        const roomId = data.room_id
        
        // Create a room object and set it as current
        const newRoom: Room = {
          id: roomId,
          host_user_id: '', // This will be set by the backend
          host_name: '',
          name: name || 'My Room',
          description: description || '',
          visibility: visibility || 'private',
          room_code: data.room?.room_code,
          created_at: new Date().toISOString(),
          is_active: false,
          member_count: 1,
          members: []
        }
        setCurrentRoom(newRoom)
        
        // Connect to WebSocket
        connectWebSocket(roomId)
        
        return roomId
      } else {
        console.error('Failed to create room')
        return null
      }
    } catch (error) {
      console.error('Failed to create room:', error)
      return null
    }
  }

  const joinRoomByCode = async (roomCode: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ room_code: roomCode })
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentRoom(data.room)
        
        // Connect to WebSocket
        connectWebSocket(data.room.id)
        
        return true
      } else {
        console.error('Failed to join room by code')
        return false
      }
    } catch (error) {
      console.error('Failed to join room by code:', error)
      return false
    }
  }

  const getPublicRooms = async (): Promise<Room[]> => {
    try {
      const response = await fetch('/api/rooms/public', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        return data.rooms || []
      } else {
        console.error('Failed to get public rooms')
        return []
      }
    } catch (error) {
      console.error('Failed to get public rooms:', error)
      return []
    }
  }

  const getMyRooms = async (): Promise<Room[]> => {
    try {
      const response = await fetch('/api/rooms/my-rooms', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        return data.rooms || []
      } else {
        console.error('Failed to get my rooms')
        return []
      }
    } catch (error) {
      console.error('Failed to get my rooms:', error)
      return []
    }
  }

  const updateRoom = async (roomId: string, updates: { name?: string, description?: string, visibility?: 'public' | 'private' }): Promise<boolean> => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        const data = await response.json()
        // Update current room if it's the one being updated
        if (currentRoom?.id === roomId) {
          setCurrentRoom({ ...currentRoom, ...data.room })
        }
        return true
      } else {
        console.error('Failed to update room')
        return false
      }
    } catch (error) {
      console.error('Failed to update room:', error)
      return false
    }
  }

  const startRoom = async (roomId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/start`, {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        // Update current room if it's the one being started
        if (currentRoom?.id === roomId) {
          setCurrentRoom({ ...currentRoom, is_active: true })
        }
        return true
      } else {
        console.error('Failed to start room')
        return false
      }
    } catch (error) {
      console.error('Failed to start room:', error)
      return false
    }
  }

  const stopRoom = async (roomId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/stop`, {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        // Update current room if it's the one being stopped
        if (currentRoom?.id === roomId) {
          setCurrentRoom({ ...currentRoom, is_active: false })
        }
        return true
      } else {
        console.error('Failed to stop room')
        return false
      }
    } catch (error) {
      console.error('Failed to stop room:', error)
      return false
    }
  }

  const deleteRoom = async (roomId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        // Clear current room if it's the one being deleted
        if (currentRoom?.id === roomId) {
          setCurrentRoom(null)
        }
        return true
      } else {
        console.error('Failed to delete room')
        return false
      }
    } catch (error) {
      console.error('Failed to delete room:', error)
      return false
    }
  }

  const joinRoom = async (roomId: string, deviceId?: string): Promise<boolean> => {
    try {
      console.log('RoomContext: Attempting to join room:', roomId)
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ room_id: roomId, device_id: deviceId })
      })

      console.log('RoomContext: Join room response status:', response.status)
      
      if (response.ok) {
        console.log('RoomContext: Join room successful, getting room state...')
        // Get room details
        const roomResponse = await fetch(`/api/rooms/${roomId}/state`, {
          credentials: 'include'
        })

        console.log('RoomContext: Room state response status:', roomResponse.status)
        
        if (roomResponse.ok) {
          const roomData = await roomResponse.json()
          console.log('RoomContext: Room data received:', roomData)
          setCurrentRoom(roomData.room)
          setPlaybackState(roomData.playback)
        } else {
          console.error('RoomContext: Failed to get room state')
        }

        // Connect to WebSocket
        console.log('RoomContext: Connecting to WebSocket...')
        connectWebSocket(roomId)
        
        return true
      } else {
        const errorData = await response.text()
        console.error('RoomContext: Failed to join room:', response.status, errorData)
        return false
      }
    } catch (error) {
      console.error('RoomContext: Failed to join room:', error)
      return false
    }
  }

  const leaveRoom = async (): Promise<void> => {
    if (!currentRoom) return

    try {
      await fetch(`/api/rooms/${currentRoom.id}/leave`, {
        method: 'POST',
        credentials: 'include'
      })

      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      setCurrentRoom(null)
      setPlaybackState(null)
      setIsConnected(false)
    } catch (error) {
      console.error('Failed to leave room:', error)
    }
  }

  const startSharing = async (): Promise<boolean> => {
    if (!currentRoom) return false

    try {
      const response = await fetch(`/api/rooms/${currentRoom.id}/start`, {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        // Update room state
        setCurrentRoom(prev => prev ? { ...prev, is_active: true } : null)
        return true
      } else {
        console.error('Failed to start sharing')
        return false
      }
    } catch (error) {
      console.error('Failed to start sharing:', error)
      return false
    }
  }

  const stopSharing = async (): Promise<boolean> => {
    if (!currentRoom) return false

    try {
      const response = await fetch(`/api/rooms/${currentRoom.id}/stop`, {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        // Update room state
        setCurrentRoom(prev => prev ? { ...prev, is_active: false } : null)
        return true
      } else {
        console.error('Failed to stop sharing')
        return false
      }
    } catch (error) {
      console.error('Failed to stop sharing:', error)
      return false
    }
  }

  const sendControlMessage = (action: string, data: any) => {
    if (!isConnected || !wsRef.current) {
      console.error('WebSocket not connected')
      return
    }

    const message = {
      type: 'CONTROL',
      payload: {
        action,
        data
      },
      timestamp: Date.now()
    }

    wsRef.current.send(JSON.stringify(message))
  }

  const value: RoomContextType = {
    currentRoom,
    playbackState,
    isConnected,
    joinRoom,
    joinRoomByCode,
    getPublicRooms,
    getMyRooms,
    leaveRoom,
    createRoom,
    startSharing,
    stopSharing,
    updateRoom,
    startRoom,
    stopRoom,
    deleteRoom,
    sendControlMessage
  }

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  )
}
