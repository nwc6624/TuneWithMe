import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../services/redis.js';
import { spotifyService } from '../services/spotify.js';
import { logger } from '../utils/logger.js';
import { Room, Member, CreateRoomRequest, JoinRoomRequest } from '../types/index.js';

const createRoomSchema = z.object({
  name: z.string().optional(),
  settings: z.object({
    resync_ms: z.number().default(1000),
    force_sync: z.boolean().default(false),
    soft_threshold_ms: z.number().default(150)
  }).optional()
});

const joinRoomSchema = z.object({
  room_id: z.string(),
  device_id: z.string().optional()
});

const startSharingSchema = z.object({
  room_id: z.string()
});

const stopSharingSchema = z.object({
  room_id: z.string()
});

export async function roomRoutes(fastify: FastifyInstance) {
  // Create a new room
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = request.session as any;
      
      if (!session.authenticated || session.role !== 'host') {
        return reply.status(403).send({ error: 'Only hosts can create rooms' });
      }
      
      const body = createRoomSchema.parse(request.body);
      const roomId = uuidv4();
      
      // Get user tokens
      const tokens = await redis.getTokens(session.user_id);
      if (!tokens) {
        return reply.status(401).send({ error: 'Tokens not found' });
      }
      
      const room: Room = {
        id: roomId,
        host_user_id: session.user_id,
        created_at: new Date(),
        settings: {
          resync_ms: body.settings?.resync_ms || 1000,
          force_sync: body.settings?.force_sync || false,
          soft_threshold_ms: body.settings?.soft_threshold_ms || 150
        },
        active_track: null,
        last_state: null,
        host_tokens: tokens,
        is_active: false
      };
      
      // Store room in Redis
      await redis.createRoom(roomId, {
        ...room,
        created_at: room.created_at.toISOString(),
        host_tokens: JSON.stringify(room.host_tokens)
      });
      
      // Add host as first member
      const hostMember: Member = {
        id: uuidv4(),
        room_id: roomId,
        role: 'host',
        user_id: session.user_id,
        display_name: session.display_name,
        joined_at: new Date()
      };
      
      await redis.addMemberToRoom(roomId, hostMember.id, {
        ...hostMember,
        joined_at: hostMember.joined_at.toISOString()
      });
      
      logger.info(`Room ${roomId} created by ${session.display_name}`);
      
      return reply.status(201).send({ room_id: roomId });
    } catch (error) {
      logger.error('Failed to create room:', error);
      return reply.status(500).send({ error: 'Failed to create room' });
    }
  });

  // Join a room
  fastify.post('/:id/join', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = request.session as any;
      
      if (!session.authenticated || session.role !== 'viewer') {
        return reply.status(403).send({ error: 'Only viewers can join rooms' });
      }
      
      const { id: roomId } = request.params as { id: string };
      const body = joinRoomSchema.parse(request.body);
      
      // Check if room exists
      const room = await redis.getRoom(roomId);
      if (!room) {
        return reply.status(404).send({ error: 'Room not found' });
      }
      
      // Check if user is already a member
      const existingMembers = await redis.getRoomMembers(roomId);
      const isAlreadyMember = existingMembers.some(
        (m: any) => m.user_id === session.user_id
      );
      
      if (isAlreadyMember) {
        return reply.status(400).send({ error: 'Already a member of this room' });
      }
      
      // Get user tokens
      const tokens = await redis.getTokens(session.user_id);
      if (!tokens) {
        return reply.status(401).send({ error: 'Tokens not found' });
      }
      
      // Create member
      const member: Member = {
        id: uuidv4(),
        room_id: roomId,
        role: 'viewer',
        user_id: session.user_id,
        display_name: session.display_name,
        viewer_tokens: tokens,
        device_preference: body.device_id ? {
          device_id: body.device_id,
          type: 'unknown',
          use_web_player: false
        } : undefined,
        joined_at: new Date()
      };
      
      await redis.addMemberToRoom(roomId, member.id, {
        ...member,
        joined_at: member.joined_at.toISOString(),
        viewer_tokens: JSON.stringify(member.viewer_tokens)
      });
      
      logger.info(`User ${session.display_name} joined room ${roomId}`);
      
      return reply.send({ success: true, member_id: member.id });
    } catch (error) {
      logger.error('Failed to join room:', error);
      return reply.status(500).send({ error: 'Failed to join room' });
    }
  });

  // Leave a room
  fastify.post('/:id/leave', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = request.session as any;
      
      if (!session.authenticated) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }
      
      const { id: roomId } = request.params as { id: string };
      
      // Get room members to find the member ID
      const members = await redis.getRoomMembers(roomId);
      const member = members.find((m: any) => m.user_id === session.user_id);
      
      if (!member) {
        return reply.status(404).send({ error: 'Not a member of this room' });
      }
      
      // Remove member from room
      await redis.removeMemberFromRoom(roomId, member.id);
      
      // If host is leaving, deactivate room
      if (member.role === 'host') {
        await redis.updateRoom(roomId, { is_active: false });
        logger.info(`Room ${roomId} deactivated - host left`);
      }
      
      logger.info(`User ${session.display_name} left room ${roomId}`);
      
      return reply.send({ success: true });
    } catch (error) {
      logger.error('Failed to leave room:', error);
      return reply.status(500).send({ error: 'Failed to leave room' });
    }
  });

  // Start sharing (host only)
  fastify.post('/:id/start', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = request.session as any;
      
      if (!session.authenticated || session.role !== 'host') {
        return reply.status(403).send({ error: 'Only hosts can start sharing' });
      }
      
      const { id: roomId } = request.params as { id: string };
      
      // Check if room exists and user is the host
      const room = await redis.getRoom(roomId);
      if (!room) {
        return reply.status(404).send({ error: 'Room not found' });
      }
      
      if (room.host_user_id !== session.user_id) {
        return reply.status(403).send({ error: 'Only the room host can start sharing' });
      }
      
      // Activate room
      await redis.updateRoom(roomId, { is_active: true });
      
      logger.info(`Room ${roomId} started sharing by ${session.display_name}`);
      
      return reply.send({ success: true });
    } catch (error) {
      logger.error('Failed to start sharing:', error);
      return reply.status(500).send({ error: 'Failed to start sharing' });
    }
  });

  // Stop sharing (host only)
  fastify.post('/:id/stop', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = request.session as any;
      
      if (!session.authenticated || session.role !== 'host') {
        return reply.status(403).send({ error: 'Only hosts can stop sharing' });
      }
      
      const { id: roomId } = request.params as { id: string };
      
      // Check if room exists and user is the host
      const room = await redis.getRoom(roomId);
      if (!room) {
        return reply.status(404).send({ error: 'Room not found' });
      }
      
      if (room.host_user_id !== session.user_id) {
        return reply.status(403).send({ error: 'Only the room host can stop sharing' });
      }
      
      // Deactivate room
      await redis.updateRoom(roomId, { is_active: false });
      
      logger.info(`Room ${roomId} stopped sharing by ${session.display_name}`);
      
      return reply.send({ success: true });
    } catch (error) {
      logger.error('Failed to stop sharing:', error);
      return reply.status(500).send({ error: 'Failed to stop sharing' });
    }
  });

  // Get room state
  fastify.get('/:id/state', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id: roomId } = request.params as { id: string };
      
      // Check if room exists
      const room = await redis.getRoom(roomId);
      if (!room) {
        return reply.status(404).send({ error: 'Room not found' });
      }
      
      // Get current playback state
      const playbackState = await redis.getPlaybackState(roomId);
      
      // Get member count
      const memberCount = await redis.getRoomMemberCount(roomId);
      
      return reply.send({
        room: {
          id: room.id,
          host_user_id: room.host_user_id,
          created_at: room.created_at,
          is_active: room.is_active,
          member_count: memberCount
        },
        playback: playbackState
      });
    } catch (error) {
      logger.error('Failed to get room state:', error);
      return reply.status(500).send({ error: 'Failed to get room state' });
    }
  });

  // Get room members
  fastify.get('/:id/members', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id: roomId } = request.params as { id: string };
      
      // Check if room exists
      const room = await redis.getRoom(roomId);
      if (!room) {
        return reply.status(404).send({ error: 'Room not found' });
      }
      
      // Get members
      const members = await redis.getRoomMembers(roomId);
      
      return reply.send({ members });
    } catch (error) {
      logger.error('Failed to get room members:', error);
      return reply.status(500).send({ error: 'Failed to get room members' });
    }
  });

  // Get user's rooms
  fastify.get('/my', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = request.session as any;
      
      if (!session.authenticated) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }
      
      // This would require a more complex query in Redis
      // For now, return empty array - can be enhanced later
      return reply.send({ rooms: [] });
    } catch (error) {
      logger.error('Failed to get user rooms:', error);
      return reply.status(500).send({ error: 'Failed to get user rooms' });
    }
  });
}
