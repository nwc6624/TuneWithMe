import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
// Session type for Fastify
interface FastifySession {
  user_id?: string;
  display_name?: string;
  role?: string;
  authenticated?: boolean;
}
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getSpotifyService } from '../services/spotify.js';
import { redis } from '../services/redis.js';
import { logger } from '../utils/logger.js';

const startAuthSchema = z.object({
  role: z.enum(['host', 'viewer'])
});

const callbackSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional()
});

export async function authRoutes(fastify: FastifyInstance) {
  // Start OAuth flow
  fastify.get('/spotify/start', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('OAuth start request received');
      
      const { role } = startAuthSchema.parse(request.query);
      logger.info(`Role parsed: ${role}`);
      
      // Generate state parameter for security
      const state = uuidv4();
      logger.info(`Generated state: ${state}`);
      
      // Store state in Redis with short TTL instead of session
      logger.info('Attempting to store OAuth state in Redis...');
      await redis.setOAuthState(state, { role, timestamp: Date.now() });
      logger.info('OAuth state stored in Redis successfully');
      
      // Debug: Log OAuth state storage
      logger.info(`OAuth state stored in Redis - State: ${state}, Role: ${role}`);
      
      // Get authorization URL from Spotify with state parameter
      logger.info('Getting Spotify authorization URL...');
      const authUrl = getSpotifyService().getAuthorizationURL(role, state);
      logger.info(`Authorization URL generated: ${authUrl}`);
      
      logger.info(`Starting OAuth flow for role: ${role}`);
      
      return reply.redirect(authUrl);
    } catch (error) {
      logger.error('Failed to start OAuth flow:', error);
      logger.error('Error details:', { message: (error as Error).message, stack: (error as Error).stack });
      return reply.status(400).send({ error: 'Invalid request parameters' });
    }
  });

  // OAuth callback
  fastify.get('/spotify/callback', async (request: FastifyRequest & { session: FastifySession }, reply: FastifyReply) => {
    try {
      const { code, state, error } = callbackSchema.parse(request.query);
      const session = request.session;
      
      // Handle access denied or other OAuth errors
      if (error) {
        logger.warn(`OAuth error: ${error}`);
        // No session cleanup needed for OAuth state
        
        if (error === 'access_denied') {
          return reply.status(400).send({ error: 'Access denied by user' });
        } else {
          return reply.status(400).send({ error: 'OAuth failed' });
        }
      }
      
      // Check if we have a code
      if (!code) {
        logger.error('No authorization code received');
        return reply.redirect('/?error=no_code');
      }
      
      // Verify state parameter from Redis
      if (!state) {
        logger.error('No state parameter received');
        return reply.status(400).send({ error: 'Missing state parameter' });
      }
      
      const oauthState = await redis.getOAuthState(state);
      if (!oauthState) {
        logger.warn('OAuth state not found in Redis, possible CSRF attack or expired state');
        return reply.status(400).send({ error: 'Invalid or expired state parameter' });
      }
      
      const role = oauthState.role;
      if (!role || !['host', 'viewer'].includes(role)) {
        logger.error('Invalid OAuth role in state data');
        return reply.status(400).send({ error: 'Invalid role' });
      }
      
      // Clean up the OAuth state from Redis
      await redis.deleteOAuthState(state);
      
      logger.info(`OAuth state verified from Redis - State: ${state}, Role: ${role}`);
      
      // Exchange code for tokens
      const tokens = await getSpotifyService().exchangeCodeForTokens(code);
      
      // Set access token to get user profile
      getSpotifyService().setAccessToken(tokens.access_token);
      const userProfile = await getSpotifyService().getUserProfile();
      
      if (!userProfile) {
        logger.error('Failed to get user profile after OAuth');
        return reply.redirect('/?error=profile_failed');
      }
      
      // Store tokens in Redis
      await redis.storeTokens(userProfile.id, {
        ...tokens,
        role,
        user_id: userProfile.id,
        display_name: userProfile.display_name
      });
      
      // Store user info in session
      session.user_id = userProfile.id;
      session.display_name = userProfile.display_name;
      session.role = role;
      session.authenticated = true;
      
      // OAuth state already cleaned up from Redis
      
      logger.info(`User ${userProfile.display_name} authenticated as ${role}`);
      
      // Redirect based on role
      if (role === 'host') {
        return reply.redirect('/dashboard');
      } else {
        return reply.redirect('/viewer');
      }
      
    } catch (error) {
      logger.error('OAuth callback failed:', error);
      // OAuth state is stored in Redis, no session cleanup needed
      return reply.status(500).send({ error: 'Authentication failed' });
    }
  });

  // Logout
  fastify.post('/logout', async (request: FastifyRequest & { session: FastifySession }, reply: FastifyReply) => {
    try {
      const session = request.session;
      
      if (session.user_id) {
        // Remove tokens from Redis
        await redis.deleteTokens(session.user_id);
        
        // Clear session
        (session as any).destroy();
        
        logger.info(`User ${session.user_id} logged out`);
      }
      
      return reply.send({ success: true });
    } catch (error) {
      logger.error('Logout failed:', error);
      return reply.status(500).send({ error: 'Logout failed' });
    }
  });

  // Get current user info
  fastify.get('/me', async (request: FastifyRequest & { session: FastifySession }, reply: FastifyReply) => {
    try {
      const session = request.session;
      
      if (!session.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }
      
      const tokens = await redis.getTokens(session.user_id);
      if (!tokens) {
        return reply.status(401).send({ error: 'Tokens not found' });
      }
      
      return reply.send({
        user_id: session.user_id,
        display_name: session.display_name,
        role: session.role,
        authenticated: true
      });
    } catch (error) {
      logger.error('Failed to get user info:', error);
      return reply.status(500).send({ error: 'Failed to get user info' });
    }
  });

  // Get current Spotify playback
  fastify.get('/spotify/currently-playing', async (request: FastifyRequest & { session: FastifySession }, reply: FastifyReply) => {
    try {
      const session = request.session;
      
      if (!session.authenticated || !session.user_id) {
        logger.info('Not authenticated for currently-playing request');
        return reply.status(401).send({ error: 'Not authenticated' });
      }
      
      // Get user tokens
      const tokens = await redis.getTokens(session.user_id);
      if (!tokens) {
        logger.info('Tokens not found for user:', session.user_id);
        return reply.status(401).send({ error: 'Tokens not found' });
      }
      
      logger.info('Getting current playback for user:', session.user_id);
      
      // Set access token and get current playback
      getSpotifyService().setAccessToken(tokens.access_token);
      const playback = await getSpotifyService().getCurrentPlayback();
      
      logger.info('Playback result:', playback);
      
      if (!playback) {
        return reply.send({ 
          is_playing: false, 
          track: null,
          position_ms: 0,
          duration_ms: 0
        });
      }
      
      // If user is a host and in a room, update the room's playback state
      if (tokens.role === 'host') {
        try {
          const userRoom = await redis.getClient().get(`user_room:${session.user_id}`);
          if (userRoom) {
            await redis.updatePlaybackState(userRoom, playback);
            logger.info(`Updated playback state for room ${userRoom}`);
          }
        } catch (error) {
          logger.error('Failed to update room playback state:', error);
          // Don't fail the request if room update fails
        }
      }
      
      return reply.send(playback);
    } catch (error) {
      logger.error('Failed to get current playback:', error);
      return reply.status(500).send({ error: 'Failed to get current playback' });
    }
  });

  // Refresh tokens
  fastify.post('/refresh', async (request: FastifyRequest & { session: FastifySession }, reply: FastifyReply) => {
    try {
      const session = request.session;
      
      if (!session.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }
      
      const tokens = await redis.getTokens(session.user_id);
      if (!tokens || !tokens.refresh_token) {
        return reply.status(401).send({ error: 'No refresh token available' });
      }
      
      // Refresh tokens
      const newTokens = await getSpotifyService().refreshTokens(tokens.refresh_token);
      
      // Update stored tokens
      await redis.storeTokens(session.user_id, {
        ...newTokens,
        role: tokens.role,
        user_id: tokens.user_id,
        display_name: tokens.display_name
      });
      
      logger.info(`Tokens refreshed for user ${session.user_id}`);
      
      return reply.send({ success: true });
    } catch (error) {
      logger.error('Token refresh failed:', error);
      return reply.status(500).send({ error: 'Token refresh failed' });
    }
  });
}
