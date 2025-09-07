export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface SpotifyTrack {
  uri: string;
  isrc?: string;
  name: string;
  artist: string;
  album: string;
  duration_ms: number;
  album_art_url?: string;
}

export interface PlaybackState {
  track: SpotifyTrack | null;
  is_playing: boolean;
  position_ms: number;
  duration_ms: number;
  context_uri?: string | undefined;
  updated_at: number;
}

export interface RoomSettings {
  resync_ms: number;
  force_sync: boolean;
  soft_threshold_ms: number;
}

export interface Room {
  id: string;
  host_user_id: string;
  host_name: string;
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  room_code?: string;
  created_at: string;
  is_active: boolean;
  member_count: number;
  members: string[];
  settings?: RoomSettings;
  active_track?: SpotifyTrack | null;
  last_state?: PlaybackState | null;
  host_tokens?: SpotifyTokens;
}

export interface Member {
  id: string;
  room_id: string;
  role: 'host' | 'viewer';
  user_id: string;
  display_name: string;
  viewer_tokens?: SpotifyTokens;
  device_preference?: {
    device_id: string;
    type: string;
    use_web_player: boolean;
  };
  last_sync?: {
    position_ms: number;
    at_ms: number;
    drift_ms: number;
  };
  joined_at: Date;
}

export interface WebSocketMessage {
  type: 'NOW_PLAYING' | 'CONTROL' | 'MEMBER_JOIN' | 'MEMBER_LEAVE' | 'SYNC_REQUEST';
  payload: any;
  timestamp: number;
}

export interface NowPlayingMessage {
  type: 'NOW_PLAYING';
  payload: PlaybackState;
  timestamp: number;
}

export interface ControlMessage {
  type: 'CONTROL';
  payload: {
    action: 'play' | 'pause' | 'seek' | 'skip' | 'settings_update';
    data: any;
  };
  timestamp: number;
}

export interface MemberJoinMessage {
  type: 'MEMBER_JOIN';
  payload: {
    member: Member;
    room_id: string;
  };
  timestamp: number;
}

export interface MemberLeaveMessage {
  type: 'MEMBER_LEAVE';
  payload: {
    member_id: string;
    room_id: string;
  };
  timestamp: number;
}

export interface SyncRequestMessage {
  type: 'SYNC_REQUEST';
  payload: {
    member_id: string;
    current_position_ms: number;
    current_track_uri: string;
  };
  timestamp: number;
}

export type RoomWebSocketMessage = 
  | NowPlayingMessage 
  | ControlMessage 
  | MemberJoinMessage 
  | MemberLeaveMessage 
  | SyncRequestMessage;

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
}

export interface AuthSession {
  user_id: string;
  display_name: string;
  tokens: SpotifyTokens;
  role: 'host' | 'viewer';
}

export interface CreateRoomRequest {
  name?: string;
  settings?: Partial<RoomSettings>;
  visibility?: 'public' | 'private';
  description?: string;
}

export interface JoinRoomRequest {
  room_id: string;
  device_id?: string;
}

export interface StartSharingRequest {
  room_id: string;
}

export interface StopSharingRequest {
  room_id: string;
}
