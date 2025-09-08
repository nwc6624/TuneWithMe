import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { redis } from '../services/redis.js'
import { getSpotifyService } from '../services/spotify.js'
import { logger } from '../utils/logger.js'

// Schema for creating a room
const createRoomSchema = z.object({
  name: z.string().optional(),
  visibility: z.enum(['public', 'private']).default('private'),
  description: z.string().optional()
})

// Schema for joining a room
const joinRoomSchema = z.object({
  room_id: z.string().optional(),
  room_code: z.string().optional(),
  device_id: z.string().optional()
})

// Schema for room state (currently unused but kept for future use)
// const roomStateSchema = z.object({
//   room_id: z.string()
// })

export default async function roomRoutes(fastify: FastifyInstance) {
  // Get user's rooms (rooms they host or are a member of)
  fastify.get('/rooms/my-rooms', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = (request as any).session
      if (!session?.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      // Get all room keys
      const keys = await redis.getClient().keys('room:*')
      const userRooms = []

      for (const key of keys) {
        const roomData = await redis.getClient().get(key)
        if (roomData) {
          const room = JSON.parse(roomData)
          // Include rooms where user is host or member
          if (room.host_user_id === session.user_id || room.members?.includes(session.user_id)) {
            userRooms.push({
              id: room.id,
              name: room.name,
              description: room.description,
              host_name: room.host_name,
              host_user_id: room.host_user_id,
              visibility: room.visibility,
              room_code: room.room_code,
              member_count: room.member_count,
              is_active: room.is_active,
              created_at: room.created_at,
              is_host: room.host_user_id === session.user_id
            })
          }
        }
      }

      // Sort by creation date (newest first)
      userRooms.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      return reply.send({ rooms: userRooms })
    } catch (error) {
      logger.error('Failed to get user rooms:', error)
      return reply.status(500).send({ error: 'Failed to get user rooms' })
    }
  })

  // Get list of public rooms
  fastify.get('/rooms/public', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Public rooms should be accessible without authentication

      // Get all room keys
      const keys = await redis.getClient().keys('room:*')
      const publicRooms = []

      for (const key of keys) {
        const roomData = await redis.getClient().get(key)
        if (roomData) {
          const room = JSON.parse(roomData)
          // Only include public rooms that are active
          if (room.visibility === 'public' && room.is_active) {
            publicRooms.push({
              id: room.id,
              name: room.name,
              description: room.description,
              host_name: room.host_name,
              member_count: room.member_count,
              created_at: room.created_at,
              is_active: room.is_active
            })
          }
        }
      }

      // Sort by member count (most popular first)
      publicRooms.sort((a, b) => b.member_count - a.member_count)

      return reply.send({ rooms: publicRooms })
    } catch (error) {
      logger.error('Failed to get public rooms:', error)
      return reply.status(500).send({ error: 'Failed to get public rooms' })
    }
  })

  // Create a new room
  fastify.post('/rooms', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = (request as any).session
      if (!session?.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { name, visibility, description } = createRoomSchema.parse(request.body)
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Generate a simple room code for private rooms
      const roomCode = visibility === 'private' 
        ? Math.random().toString(36).substr(2, 6).toUpperCase()
        : undefined
      
      // Generate random room name if none provided
      const generateRandomRoomName = () => {
        const adjectives = ['Epic', 'Amazing', 'Chill', 'Vibey', 'Cool', 'Awesome', 'Fire', 'Sick', 'Rad', 'Dope', 'Fresh', 'Smooth', 'Wild', 'Crazy', 'Sweet', 'Nice']
        const nouns = ['Vibes', 'Beats', 'Tunes', 'Jams', 'Sounds', 'Music', 'Session', 'Party', 'Groove', 'Flow', 'Wave', 'Mix', 'Playlist', 'Set', 'Show', 'Night']
        
        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)]
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)]
        const randomNumber = Math.floor(Math.random() * 999) + 1
        
        return `${randomAdjective} ${randomNoun} ${randomNumber}`
      }
      
      const room = {
        id: roomId,
        host_user_id: session.user_id,
        host_name: session.display_name || 'Unknown',
        name: name || generateRandomRoomName(),
        description: description || '',
        visibility: visibility,
        room_code: roomCode,
        created_at: new Date().toISOString(),
        is_active: visibility === 'public', // Auto-activate public rooms
        member_count: 1,
        members: [session.user_id]
      }

      // Store room in Redis
      await redis.getClient().setEx(`room:${roomId}`, 3600, JSON.stringify(room)) // 1 hour TTL
      
      // Store user's current room
      await redis.getClient().setEx(`user_room:${session.user_id}`, 3600, roomId)

      logger.info(`Room created: ${roomId} by user: ${session.user_id}, visibility: ${visibility}, is_active: ${room.is_active}`)
      
      return reply.send({ 
        room_id: roomId,
        room: room
      })
    } catch (error) {
      logger.error('Failed to create room:', error)
      return reply.status(500).send({ error: 'Failed to create room' })
    }
  })

  // Join a room by code
  fastify.post('/rooms/join', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = (request as any).session
      if (!session?.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { room_code, device_id: _device_id } = joinRoomSchema.parse(request.body)

      if (!room_code) {
        return reply.status(400).send({ error: 'Room code is required' })
      }

      // Find room by code
      const keys = await redis.getClient().keys('room:*')
      let targetRoom = null

      for (const key of keys) {
        const roomData = await redis.getClient().get(key)
        if (roomData) {
          const room = JSON.parse(roomData)
          if (room.room_code === room_code.toUpperCase()) {
            targetRoom = room
            break
          }
        }
      }

      if (!targetRoom) {
        return reply.status(404).send({ error: 'Room not found with that code' })
      }

      // Check if user is already in the room
      if (targetRoom.members.includes(session.user_id)) {
        return reply.status(400).send({ error: 'Already in room' })
      }

      // Add user to room
      targetRoom.members.push(session.user_id)
      targetRoom.member_count = targetRoom.members.length

      // Update room in Redis
      await redis.getClient().setEx(`room:${targetRoom.id}`, 3600, JSON.stringify(targetRoom))
      
      // Store user's current room
      await redis.getClient().setEx(`user_room:${session.user_id}`, 3600, targetRoom.id)

      logger.info(`User ${session.user_id} joined room: ${targetRoom.id} via code`)
      
      return reply.send({ 
        success: true,
        room: targetRoom
      })
    } catch (error) {
      logger.error('Failed to join room by code:', error)
      return reply.status(500).send({ error: 'Failed to join room' })
    }
  })

  // Join a room
  fastify.post('/rooms/:roomId/join', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = (request as any).session
      
      // Allow anonymous users to join as viewers
      let userId: string
      let userName: string
      
      if (session?.authenticated && session.user_id) {
        // Authenticated user
        userId = session.user_id
        userName = session.display_name || 'Authenticated User'
        logger.info(`Authenticated user ${userId} joining room`)
      } else {
        // Anonymous user - generate temporary ID
        userId = `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        userName = 'Anonymous Viewer'
        logger.info(`Anonymous user ${userId} joining room`)
      }

      const { roomId } = request.params as { roomId: string }
      const { room_code, device_id: _device_id } = joinRoomSchema.parse(request.body)

      logger.info(`User ${userId} attempting to join room: ${roomId}`)
      let targetRoomId = roomId
      
      // If room_code is provided, find the room by code
      if (room_code) {
        const keys = await redis.getClient().keys('room:*')
        for (const key of keys) {
          const roomData = await redis.getClient().get(key)
          if (roomData) {
            const room = JSON.parse(roomData)
            if (room.room_code === room_code.toUpperCase()) {
              targetRoomId = room.id
              break
            }
          }
        }
        if (!targetRoomId) {
          return reply.status(404).send({ error: 'Room not found with that code' })
        }
      }

      // Get room from Redis
      const roomData = await redis.getClient().get(`room:${targetRoomId}`)
      if (!roomData) {
        logger.info(`Room not found: ${targetRoomId}`)
        return reply.status(404).send({ error: 'Room not found' })
      }

      const room = JSON.parse(roomData)
      logger.info(`Found room: ${room.name} with ${room.member_count} members`)
      
      // Check if user is already in the room
      if (room.members.includes(userId)) {
        logger.info(`User ${userId} already in room: ${targetRoomId}`)
        return reply.status(400).send({ error: 'Already in room' })
      }

      // Add user to room
      room.members.push(userId)
      room.member_count = room.members.length

      // Update room in Redis
      await redis.getClient().setEx(`room:${targetRoomId}`, 3600, JSON.stringify(room))
      
      // Store user's current room (only for authenticated users)
      if (session?.authenticated && session.user_id) {
        await redis.getClient().setEx(`user_room:${userId}`, 3600, targetRoomId)
      }

      logger.info(`User ${userId} successfully joined room: ${targetRoomId}`)
      
      return reply.send({ 
        success: true,
        room: room,
        user: {
          id: userId,
          name: userName,
          is_authenticated: session?.authenticated || false
        }
      })
    } catch (error) {
      logger.error('Failed to join room:', error)
      return reply.status(500).send({ error: 'Failed to join room' })
    }
  })

  // Get room state
  fastify.get('/rooms/:roomId/state', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = (request as any).session
      const { roomId } = request.params as { roomId: string }

      // Get room from Redis
      const roomData = await redis.getClient().get(`room:${roomId}`)
      if (!roomData) {
        return reply.status(404).send({ error: 'Room not found' })
      }

      const room = JSON.parse(roomData)
      
      // For anonymous users, we'll allow access to room state without membership check
      // For authenticated users, check if they're in the room
      if (session?.authenticated && session.user_id && !room.members.includes(session.user_id)) {
        return reply.status(403).send({ error: 'Not a member of this room' })
      }

      // Get current playback state from host
      let playback = null
      if (session?.authenticated && session.user_id && room.host_user_id === session.user_id) {
        // Host gets their own playback state
        const tokens = await redis.getTokens(session.user_id)
        if (tokens) {
          getSpotifyService().setAccessToken(tokens.access_token)
          playback = await getSpotifyService().getCurrentPlayback()
        }
      } else {
        // Viewer (authenticated or anonymous) gets host's playback state
        const hostTokens = await redis.getTokens(room.host_user_id)
        if (hostTokens) {
          getSpotifyService().setAccessToken(hostTokens.access_token)
          playback = await getSpotifyService().getCurrentPlayback()
        }
      }

      return reply.send({ 
        room: room,
        playback: playback
      })
    } catch (error) {
      logger.error('Failed to get room state:', error)
      return reply.status(500).send({ error: 'Failed to get room state' })
    }
  })

  // Start sharing (activate room)
  fastify.post('/rooms/:roomId/start', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = (request as any).session
      if (!session?.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { roomId } = request.params as { roomId: string }

      // Get room from Redis
      const roomData = await redis.getClient().get(`room:${roomId}`)
      if (!roomData) {
        return reply.status(404).send({ error: 'Room not found' })
      }

      const room = JSON.parse(roomData)
      
      // Check if user is the host
      if (room.host_user_id !== session.user_id) {
        return reply.status(403).send({ error: 'Only the host can start sharing' })
      }

      // Activate room
      room.is_active = true
      await redis.getClient().setEx(`room:${roomId}`, 3600, JSON.stringify(room))

      logger.info(`Room ${roomId} started sharing by user: ${session.user_id}`)
      
      return reply.send({ success: true })
    } catch (error) {
      logger.error('Failed to start sharing:', error)
      return reply.status(500).send({ error: 'Failed to start sharing' })
    }
  })

  // Stop sharing (deactivate room)
  fastify.post('/rooms/:roomId/stop', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = (request as any).session
      if (!session?.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { roomId } = request.params as { roomId: string }

      // Get room from Redis
      const roomData = await redis.getClient().get(`room:${roomId}`)
      if (!roomData) {
        return reply.status(404).send({ error: 'Room not found' })
      }

      const room = JSON.parse(roomData)
      
      // Check if user is the host
      if (room.host_user_id !== session.user_id) {
        return reply.status(403).send({ error: 'Only the host can stop sharing' })
      }

      // Deactivate room
      room.is_active = false
      await redis.getClient().setEx(`room:${roomId}`, 3600, JSON.stringify(room))

      logger.info(`Room ${roomId} stopped sharing by user: ${session.user_id}`)
      
      return reply.send({ success: true })
    } catch (error) {
      logger.error('Failed to stop sharing:', error)
      return reply.status(500).send({ error: 'Failed to stop sharing' })
    }
  })

  // Leave room
  fastify.post('/rooms/:roomId/leave', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = (request as any).session
      if (!session?.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { roomId } = request.params as { roomId: string }

      // Get room from Redis
      const roomData = await redis.getClient().get(`room:${roomId}`)
      if (!roomData) {
        return reply.status(404).send({ error: 'Room not found' })
      }

      const room = JSON.parse(roomData)
      
      // Remove user from room
      room.members = room.members.filter((id: string) => id !== session.user_id)
      room.member_count = room.members.length

      // If no members left, delete the room
      if (room.members.length === 0) {
        await redis.getClient().del(`room:${roomId}`)
        logger.info(`Room ${roomId} deleted (no members left)`)
      } else {
        // If host left, assign new host
        if (room.host_user_id === session.user_id) {
          room.host_user_id = room.members[0]
          room.host_name = 'Unknown' // Will be updated when new host logs in
        }
        
        // Update room in Redis
        await redis.getClient().setEx(`room:${roomId}`, 3600, JSON.stringify(room))
        logger.info(`User ${session.user_id} left room: ${roomId}`)
      }

      // Remove user's room association
      await redis.getClient().del(`user_room:${session.user_id}`)
      
      return reply.send({ success: true })
    } catch (error) {
      logger.error('Failed to leave room:', error)
      return reply.status(500).send({ error: 'Failed to leave room' })
    }
  })

  // Update room settings
  fastify.put('/rooms/:roomId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = (request as any).session
      if (!session?.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { roomId } = request.params as { roomId: string }
      const { name, description, visibility } = request.body as { name?: string, description?: string, visibility?: 'public' | 'private' }
      
      // Get room data
      const roomData = await redis.getClient().get(`room:${roomId}`)
      if (!roomData) {
        return reply.status(404).send({ error: 'Room not found' })
      }

      const room = JSON.parse(roomData)
      
      // Check if user is the host
      if (room.host_user_id !== session.user_id) {
        return reply.status(403).send({ error: 'Only the host can edit the room' })
      }

      // Update room properties
      if (name !== undefined) room.name = name
      if (description !== undefined) room.description = description
      if (visibility !== undefined) {
        room.visibility = visibility
        // Generate new room code if changing to private
        if (visibility === 'private' && !room.room_code) {
          room.room_code = Math.random().toString(36).substr(2, 6).toUpperCase()
        } else if (visibility === 'public') {
          room.room_code = undefined
        }
      }

      // Update room in Redis
      await redis.getClient().setEx(`room:${roomId}`, 3600, JSON.stringify(room))

      return reply.send({ 
        message: 'Room updated successfully',
        room: {
          id: room.id,
          name: room.name,
          description: room.description,
          visibility: room.visibility,
          room_code: room.room_code
        }
      })
    } catch (error) {
      logger.error('Failed to update room:', error)
      return reply.status(500).send({ error: 'Failed to update room' })
    }
  })

  // Delete room
  fastify.delete('/rooms/:roomId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = (request as any).session
      if (!session?.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { roomId } = request.params as { roomId: string }
      
      // Get room data
      const roomData = await redis.getClient().get(`room:${roomId}`)
      if (!roomData) {
        return reply.status(404).send({ error: 'Room not found' })
      }

      const room = JSON.parse(roomData)
      
      // Check if user is the host
      if (room.host_user_id !== session.user_id) {
        return reply.status(403).send({ error: 'Only the host can delete the room' })
      }

      // Delete room from Redis
      await redis.getClient().del(`room:${roomId}`)
      
      // Remove from host poller if active
      const { hostPoller } = await import('../services/hostPoller.js')
      await hostPoller.removeRoom(roomId)

      logger.info(`Room ${roomId} deleted by user: ${session.user_id}`)
      
      return reply.send({ 
        message: 'Room deleted successfully',
        success: true
      })
    } catch (error) {
      logger.error('Failed to delete room:', error)
      return reply.status(500).send({ error: 'Failed to delete room' })
    }
  })
}
