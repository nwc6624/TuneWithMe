import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger.js';

class RedisService {
  private client: RedisClientType;
  private subscriber: RedisClientType;
  private publisher: RedisClientType;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.subscriber = this.client.duplicate();
    this.publisher = this.client.duplicate();

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    this.subscriber.on('error', (err) => {
      logger.error('Redis Subscriber Error:', err);
    });

    this.publisher.on('error', (err) => {
      logger.error('Redis Publisher Error:', err);
    });
  }

  async connect() {
    try {
      await this.client.connect();
      await this.subscriber.connect();
      await this.publisher.connect();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.client.quit();
      await this.subscriber.quit();
      await this.publisher.quit();
      logger.info('Redis disconnected successfully');
    } catch (error) {
      logger.error('Failed to disconnect from Redis:', error);
    }
  }

  // Room management
  async createRoom(roomId: string, roomData: any): Promise<void> {
    await this.client.hSet(`room:${roomId}`, roomData);
    await this.client.expire(`room:${roomId}`, 3600); // 1 hour TTL
  }

  async getRoom(roomId: string): Promise<any | null> {
    const roomData = await this.client.hGetAll(`room:${roomId}`);
    return Object.keys(roomData).length > 0 ? roomData : null;
  }

  async updateRoom(roomId: string, updates: Record<string, any>): Promise<void> {
    await this.client.hSet(`room:${roomId}`, updates);
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.client.del(`room:${roomId}`);
    await this.client.del(`room:${roomId}:members`);
    await this.client.del(`room:${roomId}:playback`);
  }

  // Member management
  async addMemberToRoom(roomId: string, memberId: string, memberData: any): Promise<void> {
    await this.client.hSet(`room:${roomId}:members`, memberId, JSON.stringify(memberData));
    await this.client.sAdd(`room:${roomId}:member_ids`, memberId);
  }

  async removeMemberFromRoom(roomId: string, memberId: string): Promise<void> {
    await this.client.hDel(`room:${roomId}:members`, memberId);
    await this.client.sRem(`room:${roomId}:member_ids`, memberId);
  }

  async getRoomMembers(roomId: string): Promise<any[]> {
    const memberIds = await this.client.sMembers(`room:${roomId}:member_ids`);
    if (memberIds.length === 0) return [];

    const members = await Promise.all(
      memberIds.map(async (memberId) => {
        const memberData = await this.client.hGet(`room:${roomId}:members`, memberId);
        return memberData ? JSON.parse(memberData) : null;
      })
    );

    return members.filter(Boolean);
  }

  async getRoomMemberCount(roomId: string): Promise<number> {
    return await this.client.sCard(`room:${roomId}:member_ids`);
  }

  // Playback state
  async updatePlaybackState(roomId: string, state: any): Promise<void> {
    await this.client.set(`room:${roomId}:playback`, JSON.stringify(state), 'EX', 300); // 5 min TTL
  }

  async getPlaybackState(roomId: string): Promise<any | null> {
    const state = await this.client.get(`room:${roomId}:playback`);
    return state ? JSON.parse(state) : null;
  }

  // Pub/Sub for WebSocket broadcasting
  async publishToRoom(roomId: string, message: any): Promise<void> {
    await this.publisher.publish(`room:${roomId}`, JSON.stringify(message));
  }

  async subscribeToRoom(roomId: string, callback: (message: any) => void): Promise<void> {
    await this.subscriber.subscribe(`room:${roomId}`, (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        callback(parsedMessage);
      } catch (error) {
        logger.error('Failed to parse Redis message:', error);
      }
    });
  }

  async unsubscribeFromRoom(roomId: string): Promise<void> {
    await this.subscriber.unsubscribe(`room:${roomId}`);
  }

  // Token management
  async storeTokens(userId: string, tokens: any): Promise<void> {
    await this.client.set(`tokens:${userId}`, JSON.stringify(tokens), 'EX', 3600); // 1 hour TTL
  }

  async getTokens(userId: string): Promise<any | null> {
    const tokens = await this.client.get(`tokens:${userId}`);
    return tokens ? JSON.parse(tokens) : null;
  }

  async deleteTokens(userId: string): Promise<void> {
    await this.client.del(`tokens:${userId}`);
  }

  // Utility methods
  async ping(): Promise<string> {
    return await this.client.ping();
  }

  async flushAll(): Promise<void> {
    await this.client.flushAll();
  }
}

export const redis = new RedisService();
