import SpotifyWebApi from 'spotify-web-api-node';
import { logger } from '../utils/logger.js';
import { 
  SpotifyTokens, 
  SpotifyTrack, 
  PlaybackState, 
  SpotifyDevice 
} from '../types/index.js';

class SpotifyService {
  private client: SpotifyWebApi;

  constructor() {
    console.log('SpotifyService constructor - Environment variables:');
    console.log('SPOTIFY_CLIENT_ID:', process.env.SPOTIFY_CLIENT_ID);
    console.log('SPOTIFY_CLIENT_SECRET:', process.env.SPOTIFY_CLIENT_SECRET ? '[SET]' : '[NOT SET]');
    console.log('SPOTIFY_REDIRECT_URI:', process.env.SPOTIFY_REDIRECT_URI);
    
    this.client = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.SPOTIFY_REDIRECT_URI,
    });
  }

  // OAuth methods
  getAuthorizationURL(role: 'host' | 'viewer', state: string): string {
    const scopes = role === 'host' 
      ? ['user-read-currently-playing', 'user-read-playback-state']
      : ['user-modify-playback-state', 'user-read-playback-state'];

    return this.client.createAuthorizeURL(scopes, state, true);
  }

  async exchangeCodeForTokens(code: string): Promise<SpotifyTokens> {
    try {
      const data = await this.client.authorizationCodeGrant(code);
      
      return {
        access_token: data.body.access_token,
        refresh_token: data.body.refresh_token,
        expires_at: Date.now() + (data.body.expires_in * 1000)
      };
    } catch (error) {
      logger.error('Failed to exchange code for tokens:', error);
      throw new Error('Failed to authenticate with Spotify');
    }
  }

  async refreshTokens(refreshToken: string): Promise<SpotifyTokens> {
    try {
      this.client.setRefreshToken(refreshToken);
      const data = await this.client.refreshAccessToken();
      
      return {
        access_token: data.body.access_token,
        refresh_token: refreshToken, // Keep the same refresh token
        expires_at: Date.now() + (data.body.expires_in * 1000)
      };
    } catch (error) {
      logger.error('Failed to refresh tokens:', error);
      throw new Error('Failed to refresh Spotify tokens');
    }
  }

  // Set tokens for API calls
  setAccessToken(accessToken: string): void {
    this.client.setAccessToken(accessToken);
  }

  // Host methods (read-only)
  async getCurrentPlayback(): Promise<any> {
    try {
      const response = await this.client.getMyCurrentPlaybackState();
      
      logger.info('Raw Spotify API response:', JSON.stringify({
        hasItem: !!response.body.item,
        isPlaying: response.body.is_playing,
        device: response.body.device?.name,
        itemName: response.body.item?.name
      }, null, 2));
      
      if (!response.body.item) {
        logger.info('No current track - returning empty playback state');
        return {
          is_playing: false,
          track: null,
          position_ms: 0,
          duration_ms: 0
        };
      }

      const track = response.body.item as any;
      const trackData = {
        uri: track.uri,
        isrc: track.external_ids?.isrc,
        name: track.name,
        artist: track.artists?.[0]?.name || 'Unknown Artist',
        album: track.album?.name || 'Unknown Album',
        duration_ms: track.duration_ms,
        album_art_url: track.album?.images?.[0]?.url
      };

      return {
        track: trackData,
        is_playing: response.body.is_playing || false,
        position_ms: response.body.progress_ms || 0,
        duration_ms: track.duration_ms,
        context_uri: response.body.context?.uri || undefined,
        updated_at: Date.now()
      };
    } catch (error) {
      logger.error('Failed to get current playback:', error);
      return {
        is_playing: false,
        track: null,
        position_ms: 0,
        duration_ms: 0
      };
    }
  }

  async getCurrentPlaybackState(): Promise<PlaybackState | null> {
    try {
      const response = await this.client.getMyCurrentPlaybackState();
      
      if (!response.body.item) {
        return null;
      }

      const track = response.body.item as any;
      const trackData: SpotifyTrack = {
        uri: track.uri,
        isrc: track.external_ids?.isrc,
        name: track.name,
        artist: track.artists?.[0]?.name || 'Unknown Artist',
        album: track.album?.name || 'Unknown Album',
        duration_ms: track.duration_ms,
        album_art_url: track.album?.images?.[0]?.url
      };

      return {
        track: trackData,
        is_playing: response.body.is_playing || false,
        position_ms: response.body.progress_ms || 0,
        duration_ms: track.duration_ms,
        context_uri: response.body.context?.uri || undefined,
        updated_at: Date.now()
      };
    } catch (error) {
      logger.error('Failed to get current playback state:', error);
      return null;
    }
  }

  async getCurrentlyPlaying(): Promise<PlaybackState | null> {
    try {
      const response = await this.client.getMyCurrentPlayingTrack();
      
      if (!response.body.item) {
        return null;
      }

      const track = response.body.item as any;
      const trackData: SpotifyTrack = {
        uri: track.uri,
        isrc: track.external_ids?.isrc,
        name: track.name,
        artist: track.artists?.[0]?.name || 'Unknown Artist',
        album: track.album?.name || 'Unknown Album',
        duration_ms: track.duration_ms,
        album_art_url: track.album?.images?.[0]?.url
      };

      return {
        track: trackData,
        is_playing: response.body.is_playing || false,
        position_ms: response.body.progress_ms || 0,
        duration_ms: track.duration_ms,
        context_uri: response.body.context?.uri || undefined,
        updated_at: Date.now()
      };
    } catch (error) {
      logger.error('Failed to get currently playing track:', error);
      return null;
    }
  }

  // Viewer methods (playback control)
  async getAvailableDevices(): Promise<SpotifyDevice[]> {
    try {
      const response = await this.client.getMyDevices();
      return response.body.devices.map((device: any) => ({
        id: device.id!,
        name: device.name!,
        type: device.type!,
        is_active: device.is_active!,
        is_private_session: device.is_private_session!,
        is_restricted: device.is_restricted!
      }));
    } catch (error) {
      logger.error('Failed to get available devices:', error);
      return [];
    }
  }

  async transferPlayback(deviceId: string): Promise<boolean> {
    try {
      await this.client.transferMyPlayback([deviceId], { play: false });
      return true;
    } catch (error) {
      logger.error('Failed to transfer playback:', error);
      return false;
    }
  }

  async playTrack(uri: string, positionMs: number = 0, contextUri?: string): Promise<boolean> {
    try {
      const playOptions: any = {};
      
      if (contextUri) {
        playOptions.context_uri = contextUri;
        if (uri !== contextUri) {
          playOptions.offset = { uri };
        }
      } else {
        playOptions.uris = [uri];
      }
      
      if (positionMs > 0) {
        playOptions.position_ms = positionMs;
      }

      await this.client.play(playOptions);
      return true;
    } catch (error) {
      logger.error('Failed to play track:', error);
      return false;
    }
  }

  async pausePlayback(): Promise<boolean> {
    try {
      await this.client.pause();
      return true;
    } catch (error) {
      logger.error('Failed to pause playback:', error);
      return false;
    }
  }

  async seekToPosition(positionMs: number): Promise<boolean> {
    try {
      await this.client.seek(positionMs);
      return true;
    } catch (error) {
      logger.error('Failed to seek to position:', error);
      return false;
    }
  }

  async skipToNext(): Promise<boolean> {
    try {
      await this.client.skipToNext();
      return true;
    } catch (error) {
      logger.error('Failed to skip to next track:', error);
      return false;
    }
  }

  async skipToPrevious(): Promise<boolean> {
    try {
      await this.client.skipToPrevious();
      return true;
    } catch (error) {
      logger.error('Failed to skip to previous track:', error);
      return false;
    }
  }

  // Utility methods
  async getUserProfile(): Promise<{ id: string; display_name: string } | null> {
    try {
      const response = await this.client.getMe();
      return {
        id: response.body.id!,
        display_name: response.body.display_name!
      };
    } catch (error) {
      logger.error('Failed to get user profile:', error);
      return null;
    }
  }

  async checkTokenValidity(): Promise<boolean> {
    try {
      await this.client.getMe();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Create a truly lazy-loaded singleton instance
let _spotifyService: SpotifyService | null = null;

export const getSpotifyService = () => {
  if (!_spotifyService) {
    // Only create the service when actually needed
    _spotifyService = new SpotifyService();
  }
  return _spotifyService;
};

// Remove the backward compatibility export that was causing early instantiation
// export const spotifyService = getSpotifyService();
