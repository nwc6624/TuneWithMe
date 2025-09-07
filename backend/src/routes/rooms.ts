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
  // Get list of public rooms
  fastify.get('/rooms/public', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = (request as any).session
      if (!session?.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

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
              created_at: room.created_at
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
      
      const room = {
        id: roomId,
        host_user_id: session.user_id,
        host_name: session.display_name || 'Unknown',
        name: name || 'My Room',
        description: description || '',
        visibility: visibility,
        room_code: roomCode,
        created_at: new Date().toISOString(),
        is_active: false,
        member_count: 1,
        members: [session.user_id]
      }

      // Store room in Redis
      await redis.getClient().setEx(`room:${roomId}`, 3600, JSON.stringify(room)) // 1 hour TTL
      
      // Store user's current room
      await redis.getClient().setEx(`user_room:${session.user_id}`, 3600, roomId)

      logger.info(`Room created: ${roomId} by user: ${session.user_id}`)
      
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
      if (!session?.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { roomId } = request.params as { roomId: string }
      const { room_code, device_id: _device_id } = joinRoomSchema.parse(request.body)

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
        return reply.status(404).send({ error: 'Room not found' })
      }

      const room = JSON.parse(roomData)
      
      // Check if user is already in the room
      if (room.members.includes(session.user_id)) {
        return reply.status(400).send({ error: 'Already in room' })
      }

      // Add user to room
      room.members.push(session.user_id)
      room.member_count = room.members.length

      // Update room in Redis
      await redis.getClient().setEx(`room:${roomId}`, 3600, JSON.stringify(room))
      
      // Store user's current room
      await redis.getClient().setEx(`user_room:${session.user_id}`, 3600, roomId)

      logger.info(`User ${session.user_id} joined room: ${roomId}`)
      
      return reply.send({ 
        success: true,
        room: room
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
      
      // Check if user is in the room
      if (!room.members.includes(session.user_id)) {
        return reply.status(403).send({ error: 'Not a member of this room' })
      }

      // Get current playback state from host
      let playback = null
      if (room.host_user_id === session.user_id) {
        // Host gets their own playback state
        const tokens = await redis.getTokens(session.user_id)
        if (tokens) {
          getSpotifyService().setAccessToken(tokens.access_token)
          playback = await getSpotifyService().getCurrentPlayback()
        }
      } else {
        // Viewer gets host's playback state
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
}
