import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { spotifyService } from '../services/spotify.js';
import { redis } from '../services/redis.js';
import { logger } from '../utils/logger.js';

const startAuthSchema = z.object({
  role: z.enum(['host', 'viewer'])
});

const callbackSchema = z.object({
  code: z.string(),
  state: z.string().optional()
});

export async function authRoutes(fastify: FastifyInstance) {
  // Start OAuth flow
  fastify.get('/spotify/start', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { role } = startAuthSchema.parse(request.query);
      
      // Generate state parameter for security
      const state = uuidv4();
      
      // Store state in session
      (request.session as any).oauth_state = state;
      (request.session as any).oauth_role = role;
      
      // Get authorization URL from Spotify
      const authUrl = spotifyService.getAuthorizationURL(role);
      
      // Add state parameter to URL
      const finalUrl = `${authUrl}&state=${state}`;
      
      logger.info(`Starting OAuth flow for role: ${role}`);
      
      return reply.redirect(finalUrl);
    } catch (error) {
      logger.error('Failed to start OAuth flow:', error);
      return reply.status(400).send({ error: 'Invalid request parameters' });
    }
  });

  // OAuth callback
  fastify.get('/spotify/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { code, state } = callbackSchema.parse(request.query);
      const session = request.session as any;
      
      // Verify state parameter
      if (!session.oauth_state || session.oauth_state !== state) {
        logger.warn('OAuth state mismatch, possible CSRF attack');
        return reply.status(400).send({ error: 'Invalid state parameter' });
      }
      
      const role = session.oauth_role;
      if (!role || !['host', 'viewer'].includes(role)) {
        logger.error('Invalid OAuth role in session');
        return reply.status(400).send({ error: 'Invalid role' });
      }
      
      // Exchange code for tokens
      const tokens = await spotifyService.exchangeCodeForTokens(code);
      
      // Set access token to get user profile
      spotifyService.setAccessToken(tokens.access_token);
      const userProfile = await spotifyService.getUserProfile();
      
      if (!userProfile) {
        logger.error('Failed to get user profile after OAuth');
        return reply.status(500).send({ error: 'Failed to get user profile' });
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
      
      // Clear OAuth state
      delete session.oauth_state;
      delete session.oauth_role;
      
      logger.info(`User ${userProfile.display_name} authenticated as ${role}`);
      
      // Redirect based on role
      if (role === 'host') {
        return reply.redirect('/dashboard');
      } else {
        return reply.redirect('/viewer');
      }
      
    } catch (error) {
      logger.error('OAuth callback failed:', error);
      return reply.status(500).send({ error: 'Authentication failed' });
    }
  });

  // Logout
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = request.session as any;
      
      if (session.user_id) {
        // Remove tokens from Redis
        await redis.deleteTokens(session.user_id);
        
        // Clear session
        session.destroy();
        
        logger.info(`User ${session.user_id} logged out`);
      }
      
      return reply.send({ success: true });
    } catch (error) {
      logger.error('Logout failed:', error);
      return reply.status(500).send({ error: 'Logout failed' });
    }
  });

  // Get current user info
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = request.session as any;
      
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

  // Refresh tokens
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = request.session as any;
      
      if (!session.authenticated || !session.user_id) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }
      
      const tokens = await redis.getTokens(session.user_id);
      if (!tokens || !tokens.refresh_token) {
        return reply.status(401).send({ error: 'No refresh token available' });
      }
      
      // Refresh tokens
      const newTokens = await spotifyService.refreshTokens(tokens.refresh_token);
      
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
