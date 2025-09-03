// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

// Debug: Check if environment variables are loaded
console.log('Environment variables after dotenv.config():');
console.log('SPOTIFY_CLIENT_ID:', process.env.SPOTIFY_CLIENT_ID ? '[SET]' : '[NOT SET]');
console.log('SPOTIFY_CLIENT_SECRET:', process.env.SPOTIFY_CLIENT_SECRET ? '[SET]' : '[NOT SET]');
console.log('SPOTIFY_REDIRECT_URI:', process.env.SPOTIFY_REDIRECT_URI ? '[SET]' : '[NOT SET]');

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import session from '@fastify/session';
import cookie from '@fastify/cookie';

import { authRoutes } from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import { overlayRoutes } from './routes/overlay.js';
import { setupWebSocket } from './websocket/index.js';
import { redis } from './services/redis.js';
import { logger } from './utils/logger.js';

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  }
});

// Register plugins
await fastify.register(cors, {
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
});

await fastify.register(cookie);
await fastify.register(session, {
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  cookie: {
    secure: false, // Force false for development to work with HTTP
    httpOnly: true,
    sameSite: 'lax', // Use lax for better compatibility
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
    domain: undefined // Let browser handle domain automatically
  },
  // Ensure sessions are saved and persisted
  saveUninitialized: true,
  resave: true,
  name: 'sessionId', // Explicitly set cookie name
  // Additional session options for better persistence
  rolling: true,
  unset: 'destroy'
});

await fastify.register(websocket);

// Connect to Redis before registering routes
logger.info('Connecting to Redis...');
await redis.connect();
logger.info('Redis connected successfully');

// Register routes
await fastify.register(authRoutes, { prefix: '/auth' });
await fastify.register(roomRoutes, { prefix: '/api' });
await fastify.register(overlayRoutes, { prefix: '/overlay' });

// Setup WebSocket handling
setupWebSocket(fastify);

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Frontend routes - serve the React app
fastify.get('/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
  // Redirect to frontend dashboard
  return reply.redirect('http://127.0.0.1:3000/dashboard');
});

fastify.get('/viewer', async (request: FastifyRequest, reply: FastifyReply) => {
  // Redirect to frontend viewer page
  return reply.redirect('http://127.0.0.1:3000/viewer');
});

// Catch-all route for any other frontend routes (but not API routes)
fastify.get('*', async (request: FastifyRequest, reply: FastifyReply) => {
  // Don't redirect API routes
  if (request.url.startsWith('/api') || request.url.startsWith('/auth') || request.url.startsWith('/overlay') || request.url.startsWith('/ws')) {
    return reply.status(404).send({ error: 'Not found' });
  }
  // Redirect to frontend
  return reply.redirect('http://127.0.0.1:3000');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await redis.disconnect();
  await fastify.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  await redis.disconnect();
  await fastify.close();
  process.exit(0);
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001');
    await fastify.listen({ port, host: '0.0.0.0' });
    logger.info(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
