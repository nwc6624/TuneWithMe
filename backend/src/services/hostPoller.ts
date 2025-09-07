import { redis } from './redis.js';
import { getSpotifyService } from './spotify.js';
import { wsManager } from '../websocket/index.js';
import { logger } from '../utils/logger.js';
import { PlaybackState } from '../types/index.js';

interface ActiveRoom {
  roomId: string;
  hostTokens: any;
  lastState: PlaybackState | null;
  pollInterval: NodeJS.Timeout;
  consecutiveErrors: number;
}

class HostPollerService {
  private activeRooms: Map<string, ActiveRoom> = new Map();
  private isRunning: boolean = false;

  constructor() {
    this.startPolling();
  }

  async startPolling() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    logger.info('Host poller service started');

    // Poll every second for active rooms
    setInterval(async () => {
      await this.pollActiveRooms();
    }, 1000);
  }

  async stopPolling() {
    this.isRunning = false;
    
    // Clear all polling intervals
    for (const room of this.activeRooms.values()) {
      clearInterval(room.pollInterval);
    }
    this.activeRooms.clear();
    
    logger.info('Host poller service stopped');
  }

  async addRoom(roomId: string, hostTokens: any) {
    try {
      // Stop existing polling if room is already active
      if (this.activeRooms.has(roomId)) {
        await this.removeRoom(roomId);
      }

      const activeRoom: ActiveRoom = {
        roomId,
        hostTokens,
        lastState: null,
        pollInterval: setInterval(async () => {
          await this.pollRoom(roomId);
        }, parseInt(process.env.HOST_POLL_INTERVAL_MS || '1000')),
        consecutiveErrors: 0
      };

      this.activeRooms.set(roomId, activeRoom);
      logger.info(`Started polling for room ${roomId}`);

      // Initial poll
      await this.pollRoom(roomId);

    } catch (error) {
      logger.error(`Failed to add room ${roomId} to poller:`, error);
    }
  }

  async removeRoom(roomId: string) {
    try {
      const activeRoom = this.activeRooms.get(roomId);
      if (activeRoom) {
        clearInterval(activeRoom.pollInterval);
        this.activeRooms.delete(roomId);
        logger.info(`Stopped polling for room ${roomId}`);
      }
    } catch (error) {
      logger.error(`Failed to remove room ${roomId} from poller:`, error);
    }
  }

  private async pollActiveRooms() {
    try {
      // Get all active rooms from Redis
      const activeRoomIds = await this.getActiveRoomIds();
      
      // Remove rooms that are no longer active
      for (const [roomId, _activeRoom] of this.activeRooms.entries()) {
        if (!activeRoomIds.includes(roomId)) {
          await this.removeRoom(roomId);
        }
      }

      // Add new active rooms
      for (const roomId of activeRoomIds) {
        if (!this.activeRooms.has(roomId)) {
          const room = await redis.getRoom(roomId);
          if (room && room.host_tokens) {
            const hostTokens = typeof room.host_tokens === 'string' 
              ? JSON.parse(room.host_tokens) 
              : room.host_tokens;
            await this.addRoom(roomId, hostTokens);
          }
        }
      }

    } catch (error) {
      logger.error('Failed to poll active rooms:', error);
    }
  }

  private async getActiveRoomIds(): Promise<string[]> {
    try {
      // This is a simplified approach - in production you might want to maintain
      // a separate set of active room IDs in Redis
      const activeRooms: string[] = [];
      
      // For now, we'll check all rooms - this can be optimized later
      // by maintaining an active rooms index in Redis
      
      return activeRooms;
    } catch (error) {
      logger.error('Failed to get active room IDs:', error);
      return [];
    }
  }

  private async pollRoom(roomId: string) {
    try {
      const activeRoom = this.activeRooms.get(roomId);
      if (!activeRoom) {
        return;
      }

      // Check if tokens are expired
      if (Date.now() >= activeRoom.hostTokens.expires_at) {
        logger.warn(`Host tokens expired for room ${roomId}, attempting refresh`);
        await this.refreshHostTokens(roomId, activeRoom);
        return;
      }

      // Set access token for API calls
      getSpotifyService().setAccessToken(activeRoom.hostTokens.access_token);

      // Get current playback state
      const currentState = await getSpotifyService().getCurrentPlaybackState();
      
      if (currentState) {
        // Check if state has changed
        if (this.hasStateChanged(activeRoom.lastState, currentState)) {
          // Update stored state
          await redis.updatePlaybackState(roomId, currentState);
          
          // Broadcast to all viewers
          await wsManager.broadcastNowPlaying(roomId, currentState);
          
          // Update local state
          activeRoom.lastState = currentState;
          
          // Reset error count
          activeRoom.consecutiveErrors = 0;
          
          logger.debug(`Playback state updated for room ${roomId}: ${currentState.track?.name}`);
        }
      } else {
        // No playback state - might be paused, stopped, or no active device
        if (activeRoom.lastState && activeRoom.lastState.is_playing) {
          // Transition from playing to stopped/paused
          const stoppedState: PlaybackState = {
            ...activeRoom.lastState,
            is_playing: false,
            updated_at: Date.now()
          };
          
          await redis.updatePlaybackState(roomId, stoppedState);
          await wsManager.broadcastNowPlaying(roomId, stoppedState);
          activeRoom.lastState = stoppedState;
          
          logger.debug(`Playback stopped for room ${roomId}`);
        }
      }

    } catch (error) {
      const activeRoom = this.activeRooms.get(roomId);
      if (activeRoom) {
        activeRoom.consecutiveErrors++;
        
        // If too many consecutive errors, stop polling for this room
        if (activeRoom.consecutiveErrors >= 5) {
          logger.error(`Too many consecutive errors for room ${roomId}, stopping polling`);
          await this.removeRoom(roomId);
          
          // Mark room as inactive
          await redis.updateRoom(roomId, { is_active: false });
        }
      }
      
      logger.error(`Failed to poll room ${roomId}:`, error);
    }
  }

  private async refreshHostTokens(roomId: string, activeRoom: ActiveRoom) {
    try {
              const newTokens = await getSpotifyService().refreshTokens(activeRoom.hostTokens.refresh_token);
      
      // Update tokens in Redis
      await redis.updateRoom(roomId, { 
        host_tokens: JSON.stringify(newTokens) 
      });
      
      // Update local tokens
      activeRoom.hostTokens = newTokens;
      
      logger.info(`Host tokens refreshed for room ${roomId}`);
      
    } catch (error) {
      logger.error(`Failed to refresh host tokens for room ${roomId}:`, error);
      
      // If refresh fails, stop polling and mark room as inactive
      await this.removeRoom(roomId);
      await redis.updateRoom(roomId, { is_active: false });
    }
  }

  private hasStateChanged(oldState: PlaybackState | null, newState: PlaybackState): boolean {
    if (!oldState) {
      return true;
    }

    // Check if track changed
    if (oldState.track?.uri !== newState.track?.uri) {
      return true;
    }

    // Check if play/pause state changed
    if (oldState.is_playing !== newState.is_playing) {
      return true;
    }

    // Check if position changed significantly (more than 2 seconds)
    const positionDiff = Math.abs(oldState.position_ms - newState.position_ms);
    if (positionDiff > 2000) {
      return true;
    }

    return false;
  }

  // Get status of all active rooms
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeRoomCount: this.activeRooms.size,
      activeRooms: Array.from(this.activeRooms.keys())
    };
  }

  // Force poll a specific room (useful for testing)
  async forcePollRoom(roomId: string) {
    const activeRoom = this.activeRooms.get(roomId);
    if (activeRoom) {
      await this.pollRoom(roomId);
    }
  }
}

export const hostPoller = new HostPollerService();
