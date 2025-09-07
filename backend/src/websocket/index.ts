import { FastifyInstance } from 'fastify';
import { redis } from '../services/redis.js';
import { logger } from '../utils/logger.js';
import { RoomWebSocketMessage, NowPlayingMessage } from '../types/index.js';

interface WebSocketConnection {
  id: string;
  roomId: string;
  userId: string;
  role: 'host' | 'viewer';
  ws: any;
}

class WebSocketManager {
  private connections: Map<string, WebSocketConnection> = new Map();
  private roomConnections: Map<string, Set<string>> = new Map();

  constructor() {
    this.setupRedisSubscriptions();
  }

  private setupRedisSubscriptions() {
    // This will be called when rooms are created/activated
    logger.info('WebSocket manager initialized');
  }

  async handleConnection(ws: any, request: any, roomId: string) {
    try {
      const session = request.session as any;
      
      if (!session.authenticated || !session.user_id) {
        ws.close(1008, 'Authentication required');
        return;
      }

      const connectionId = `${session.user_id}-${Date.now()}`;
      
      const connection: WebSocketConnection = {
        id: connectionId,
        roomId,
        userId: session.user_id,
        role: session.role,
        ws
      };

      // Store connection
      this.connections.set(connectionId, connection);
      
      // Add to room connections
      if (!this.roomConnections.has(roomId)) {
        this.roomConnections.set(roomId, new Set());
      }
      this.roomConnections.get(roomId)!.add(connectionId);

      // Subscribe to Redis pub/sub for this room
      await redis.subscribeToRoom(roomId, (message) => {
        this.broadcastToRoom(roomId, message);
      });

      logger.info(`WebSocket connection established: ${connectionId} for room ${roomId}`);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        payload: {
          connection_id: connectionId,
          room_id: roomId,
          user_id: session.user_id,
          role: session.role
        },
        timestamp: Date.now()
      }));

      // Handle incoming messages
      ws.on('message', (data: string) => {
        try {
          const message: RoomWebSocketMessage = JSON.parse(data);
          this.handleMessage(connection, message);
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'ERROR',
            payload: { error: 'Invalid message format' },
            timestamp: Date.now()
          }));
        }
      });

      // Handle connection close
      ws.on('close', () => {
        this.handleDisconnection(connectionId);
      });

      // Handle errors
      ws.on('error', (error: any) => {
        logger.error(`WebSocket error for ${connectionId}:`, error);
        this.handleDisconnection(connectionId);
      });

    } catch (error) {
      logger.error('Failed to handle WebSocket connection:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  private async handleMessage(connection: WebSocketConnection, message: RoomWebSocketMessage) {
    try {
      switch (message.type) {
        case 'SYNC_REQUEST':
          await this.handleSyncRequest(connection, message);
          break;
        
        case 'CONTROL':
          await this.handleControlMessage(connection, message);
          break;
        
        default:
          logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Failed to handle WebSocket message:', error);
      connection.ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { error: 'Failed to process message' },
        timestamp: Date.now()
      }));
    }
  }

  private async handleSyncRequest(connection: WebSocketConnection, message: any) {
    try {
      const { member_id, current_position_ms: _current_position_ms, current_track_uri: _current_track_uri } = message.payload;
      
      // Get current room state
      const playbackState = await redis.getPlaybackState(connection.roomId);
      
      if (playbackState) {
        // Send current state to the requesting member
        const nowPlayingMessage: NowPlayingMessage = {
          type: 'NOW_PLAYING',
          payload: playbackState,
          timestamp: Date.now()
        };
        
        connection.ws.send(JSON.stringify(nowPlayingMessage));
        
        logger.debug(`Sync request fulfilled for member ${member_id} in room ${connection.roomId}`);
      }
    } catch (error) {
      logger.error('Failed to handle sync request:', error);
    }
  }

  private async handleControlMessage(connection: WebSocketConnection, message: any) {
    try {
      const { action, data } = message.payload;
      
      // Only hosts can send control messages
      if (connection.role !== 'host') {
        logger.warn(`Non-host user ${connection.userId} attempted to send control message`);
        return;
      }
      
      // Broadcast control message to all room members
      await this.broadcastToRoom(connection.roomId, {
        type: 'CONTROL',
        payload: { action, data },
        timestamp: Date.now()
      });
      
      logger.info(`Control message broadcast: ${action} in room ${connection.roomId}`);
    } catch (error) {
      logger.error('Failed to handle control message:', error);
    }
  }

  async broadcastToRoom(roomId: string, message: any) {
    try {
      const roomConnections = this.roomConnections.get(roomId);
      if (!roomConnections) {
        return;
      }

      const messageStr = JSON.stringify(message);
      const disconnectedConnections: string[] = [];

      for (const connectionId of roomConnections) {
        const connection = this.connections.get(connectionId);
        if (connection && connection.ws.readyState === 1) { // WebSocket.OPEN
          try {
            connection.ws.send(messageStr);
          } catch (error) {
            logger.error(`Failed to send message to ${connectionId}:`, error);
            disconnectedConnections.push(connectionId);
          }
        } else {
          disconnectedConnections.push(connectionId);
        }
      }

      // Clean up disconnected connections
      disconnectedConnections.forEach(connectionId => {
        this.handleDisconnection(connectionId);
      });

    } catch (error) {
      logger.error(`Failed to broadcast to room ${roomId}:`, error);
    }
  }

  private handleDisconnection(connectionId: string) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        return;
      }

      const { roomId, userId, role } = connection;

      // Remove from connections
      this.connections.delete(connectionId);

      // Remove from room connections
      const roomConnections = this.roomConnections.get(roomId);
      if (roomConnections) {
        roomConnections.delete(connectionId);
        
        // If no more connections in room, clean up
        if (roomConnections.size === 0) {
          this.roomConnections.delete(roomId);
          // Unsubscribe from Redis pub/sub
          redis.unsubscribeFromRoom(roomId).catch(error => {
            logger.error(`Failed to unsubscribe from room ${roomId}:`, error);
          });
        }
      }

      logger.info(`WebSocket connection closed: ${connectionId} for room ${roomId}`);

      // Broadcast member leave message
      this.broadcastToRoom(roomId, {
        type: 'MEMBER_LEAVE',
        payload: {
          member_id: connectionId,
          room_id: roomId,
          user_id: userId,
          role
        },
        timestamp: Date.now()
      }).catch(error => {
        logger.error(`Failed to broadcast member leave for ${connectionId}:`, error);
      });

    } catch (error) {
      logger.error(`Failed to handle disconnection for ${connectionId}:`, error);
    }
  }

  // Method to broadcast NOW_PLAYING messages from host poller
  async broadcastNowPlaying(roomId: string, playbackState: any) {
    const message: NowPlayingMessage = {
      type: 'NOW_PLAYING',
      payload: playbackState,
      timestamp: Date.now()
    };

    await this.broadcastToRoom(roomId, message);
  }

  // Get connection count for a room
  getRoomConnectionCount(roomId: string): number {
    return this.roomConnections.get(roomId)?.size || 0;
  }

  // Get total connection count
  getTotalConnectionCount(): number {
    return this.connections.size;
  }
}

export const wsManager = new WebSocketManager();

export function setupWebSocket(fastify: FastifyInstance) {
  fastify.register(async function (fastify) {
    fastify.get('/ws/rooms/:room_id', { websocket: true }, async (connection, request) => {
      const { room_id } = request.params as { room_id: string };
      await wsManager.handleConnection(connection.socket, request, room_id);
    });
  });
}
