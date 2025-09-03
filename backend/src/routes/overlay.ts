import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../services/redis.js';
import { logger } from '../utils/logger.js';

export async function overlayRoutes(fastify: FastifyInstance) {
  // Main overlay page for a room
  fastify.get('/:room_id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { room_id } = request.params as { room_id: string };
      
      // Check if room exists
      const room = await redis.getRoom(room_id);
      if (!room) {
        return reply.status(404).send('Room not found');
      }
      
      // Get current playback state
      const playbackState = await redis.getPlaybackState(room_id);
      
      // Set content type to HTML
      reply.type('text/html');
      
      // Generate overlay HTML
      const overlayHtml = generateOverlayHTML(room_id, room, playbackState);
      
      return reply.send(overlayHtml);
    } catch (error) {
      logger.error('Failed to generate overlay:', error);
      return reply.status(500).send('Failed to generate overlay');
    }
  });

  // JSON endpoint for overlay data (useful for custom overlays)
  fastify.get('/:room_id/data', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { room_id } = request.params as { room_id: string };
      
      // Check if room exists
      const room = await redis.getRoom(room_id);
      if (!room) {
        return reply.status(404).send({ error: 'Room not found' });
      }
      
      // Get current playback state from Redis
      const playbackState = await redis.getPlaybackState(room_id);
      
      // Add debugging information
      const debugInfo = {
        room_id,
        room_exists: !!room,
        playback_state_exists: !!playbackState,
        playback_data: playbackState,
        timestamp: new Date().toISOString()
      };
      
      logger.info('Overlay data request:', debugInfo);
      
      return reply.send({
        room: {
          id: room.id,
          is_active: room.is_active
        },
        playback: playbackState,
        debug: debugInfo
      });
    } catch (error) {
      logger.error('Failed to get overlay data:', error);
      return reply.status(500).send({ error: 'Failed to get overlay data' });
    }
  });

  // CSS-only endpoint for custom styling
  fastify.get('/:room_id/style.css', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { room_id } = request.params as { room_id: string };
      
      // Check if room exists
      const room = await redis.getRoom(room_id);
      if (!room) {
        return reply.status(404).send('Room not found');
      }
      
      // Set content type to CSS
      reply.type('text/css');
      
      // Generate overlay CSS
      const overlayCSS = generateOverlayCSS();
      
      return reply.send(overlayCSS);
    } catch (error) {
      logger.error('Failed to generate overlay CSS:', error);
      return reply.status(500).send('Failed to generate overlay CSS');
    }
  });
}

function generateOverlayHTML(roomId: string, room: any, playbackState: any): string {
  const track = playbackState?.track;
  const isPlaying = playbackState?.is_playing || false;
  const position = playbackState?.position_ms || 0;
  const duration = playbackState?.duration_ms || 0;
  
  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;
  const positionFormatted = formatTime(position);
  const durationFormatted = formatTime(duration);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TuneWithMe - ${roomId}</title>
    <link rel="stylesheet" href="/overlay/${roomId}/style.css">
    <script>
        // Auto-refresh overlay every 2 seconds
        setInterval(() => {
            fetch('/overlay/${roomId}/data')
                .then(response => response.json())
                .then(data => {
                    if (data.playback) {
                        updateOverlay(data.playback);
                    }
                })
                .catch(error => console.error('Failed to update overlay:', error));
        }, 2000);
        
        function updateOverlay(playback) {
            const trackName = document.getElementById('track-name');
            const artistName = document.getElementById('artist-name');
            const albumArt = document.getElementById('album-art');
            const progressBar = document.getElementById('progress-bar');
            const positionTime = document.getElementById('position-time');
            const durationTime = document.getElementById('duration-time');
            const statusIndicator = document.getElementById('status-indicator');
            
            if (playback.track) {
                trackName.textContent = playback.track.name;
                artistName.textContent = playback.track.artist;
                if (playback.track.album_art_url) {
                    albumArt.src = playback.track.album_art_url;
                }
                
                const progressPercent = playback.duration_ms > 0 ? 
                    (playback.position_ms / playback.duration_ms) * 100 : 0;
                progressBar.style.width = progressPercent + '%';
                
                positionTime.textContent = formatTime(playback.position_ms);
                durationTime.textContent = formatTime(playback.duration_ms);
                
                statusIndicator.className = 'status-indicator ' + 
                    (playback.is_playing ? 'playing' : 'paused');
                statusIndicator.textContent = playback.is_playing ? '▶' : '⏸';
            } else {
                trackName.textContent = 'No track playing';
                artistName.textContent = '';
                albumArt.src = '';
                progressBar.style.width = '0%';
                positionTime.textContent = '0:00';
                durationTime.textContent = '0:00';
                statusIndicator.className = 'status-indicator stopped';
                statusIndicator.textContent = '⏹';
            }
        }
        
        function formatTime(ms) {
            if (!ms || ms <= 0) return '0:00';
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return minutes + ':' + remainingSeconds.toString().padStart(2, '0');
        }
    </script>
</head>
<body>
    <div class="overlay-container">
        <div class="track-info">
            <div class="album-art-container">
                <img id="album-art" class="album-art" src="${track?.album_art_url || ''}" alt="Album Art">
                <div id="status-indicator" class="status-indicator ${isPlaying ? 'playing' : 'paused'}">
                    ${isPlaying ? '▶' : '⏸'}
                </div>
            </div>
            <div class="track-details">
                <div id="track-name" class="track-name">${track?.name || 'No track playing'}</div>
                <div id="artist-name" class="artist-name">${track?.artist || ''}</div>
            </div>
        </div>
        <div class="progress-container">
            <div class="progress-bar-bg">
                <div id="progress-bar" class="progress-bar" style="width: ${progressPercent}%"></div>
            </div>
            <div class="time-info">
                <span id="position-time" class="position-time">${positionFormatted}</span>
                <span id="duration-time" class="duration-time">${durationFormatted}</span>
            </div>
        </div>
    </div>
</body>
</html>`;
}

function generateOverlayCSS(): string {
  return `
.overlay-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    color: white;
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    max-width: 400px;
    min-width: 300px;
}

.track-info {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
}

.album-art-container {
    position: relative;
    margin-right: 15px;
}

.album-art {
    width: 80px;
    height: 80px;
    border-radius: 10px;
    object-fit: cover;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.status-indicator {
    position: absolute;
    bottom: -5px;
    right: -5px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.status-indicator.playing {
    background: #4CAF50;
    color: white;
}

.status-indicator.paused {
    background: #FF9800;
    color: white;
}

.status-indicator.stopped {
    background: #F44336;
    color: white;
}

.track-details {
    flex: 1;
    min-width: 0;
}

.track-name {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.artist-name {
    font-size: 14px;
    opacity: 0.8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.progress-container {
    margin-top: 15px;
}

.progress-bar-bg {
    background: rgba(255, 255, 255, 0.2);
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 10px;
}

.progress-bar {
    background: linear-gradient(90deg, #4CAF50, #8BC34A);
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
}

.time-info {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    opacity: 0.7;
}

.position-time, .duration-time {
    font-family: 'Courier New', monospace;
}

/* Responsive adjustments */
@media (max-width: 480px) {
    .overlay-container {
        padding: 15px;
        min-width: 250px;
    }
    
    .album-art {
        width: 60px;
        height: 60px;
    }
    
    .track-name {
        font-size: 16px;
    }
    
    .artist-name {
        font-size: 13px;
    }
}

/* Animation for status changes */
.status-indicator {
    transition: all 0.3s ease;
}

.progress-bar {
    transition: width 0.5s ease;
}

/* Hover effects */
.overlay-container:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    transition: all 0.3s ease;
}`;
}

function formatTime(ms: number): string {
  if (!ms || ms <= 0) return '0:00';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
