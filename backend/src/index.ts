import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import session from '@fastify/session';
import cookie from '@fastify/cookie';
import dotenv from 'dotenv';

import { authRoutes } from './routes/auth.js';
import { roomRoutes } from './routes/rooms.js';
import { overlayRoutes } from './routes/overlay.js';
import { setupWebSocket } from './websocket/index.js';
import { redis } from './services/redis.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

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
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
});

await fastify.register(cookie);
await fastify.register(session, {
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  }
});

await fastify.register(websocket);

// Register routes
await fastify.register(authRoutes, { prefix: '/auth' });
await fastify.register(roomRoutes, { prefix: '/rooms' });
await fastify.register(overlayRoutes, { prefix: '/overlay' });

// Setup WebSocket handling
setupWebSocket(fastify);

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await redis.quit();
  await fastify.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  await redis.quit();
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
