import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { redis } from '../services/redis.js'
import { getSpotifyService } from '../services/spotify.js'
import { logger } from '../utils/logger.js'

// Schema for creating a room
const createRoomSchema = z.object({
  name: z.string().optional()
})

// Schema for joining a room
const joinRoomSchema = z.object({
  room_id: z.string(),
  device_id: z.string().optional()
})

// Schema for room state
const roomStateSchema = z.object({
  room_id: z.string()
})

export default async function roomRoutes(fastify: FastifyInstance) {
  // Create a new room
  fastify.post('/rooms', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = (request as any).session
      if (!session?.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { name } = createRoomSchema.parse(request.body)
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const room = {
        id: roomId,
        host_user_id: session.user_id,
        host_name: session.display_name || 'Unknown',
        name: name || 'My Room',
        created_at: new Date().toISOString(),
        is_active: false,
        member_count: 1,
        members: [session.user_id]
      }

      // Store room in Redis
      await redis.client.setEx(`room:${roomId}`, 3600, JSON.stringify(room)) // 1 hour TTL
      
      // Store user's current room
      await redis.client.setEx(`user_room:${session.user_id}`, 3600, roomId)

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

  // Join a room
  fastify.post('/rooms/:roomId/join', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = (request as any).session
      if (!session?.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { roomId } = request.params as { roomId: string }
      const { device_id } = joinRoomSchema.parse(request.body)

      // Get room from Redis
      const roomData = await redis.client.get(`room:${roomId}`)
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
      await redis.client.setEx(`room:${roomId}`, 3600, JSON.stringify(room))
      
      // Store user's current room
      await redis.client.setEx(`user_room:${session.user_id}`, 3600, roomId)

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
      const roomData = await redis.client.get(`room:${roomId}`)
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
      const roomData = await redis.client.get(`room:${roomId}`)
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
      await redis.client.setEx(`room:${roomId}`, 3600, JSON.stringify(room))

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
      const roomData = await redis.client.get(`room:${roomId}`)
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
      await redis.client.setEx(`room:${roomId}`, 3600, JSON.stringify(room))

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
      const roomData = await redis.client.get(`room:${roomId}`)
      if (!roomData) {
        return reply.status(404).send({ error: 'Room not found' })
      }

      const room = JSON.parse(roomData)
      
      // Remove user from room
      room.members = room.members.filter((id: string) => id !== session.user_id)
      room.member_count = room.members.length

      // If no members left, delete the room
      if (room.members.length === 0) {
        await redis.client.del(`room:${roomId}`)
        logger.info(`Room ${roomId} deleted (no members left)`)
      } else {
        // If host left, assign new host
        if (room.host_user_id === session.user_id) {
          room.host_user_id = room.members[0]
          room.host_name = 'Unknown' // Will be updated when new host logs in
        }
        
        // Update room in Redis
        await redis.client.setEx(`room:${roomId}`, 3600, JSON.stringify(room))
        logger.info(`User ${session.user_id} left room: ${roomId}`)
      }

      // Remove user's room association
      await redis.client.del(`user_room:${session.user_id}`)
      
      return reply.send({ success: true })
    } catch (error) {
      logger.error('Failed to leave room:', error)
      return reply.status(500).send({ error: 'Failed to leave room' })
    }
  })
}
