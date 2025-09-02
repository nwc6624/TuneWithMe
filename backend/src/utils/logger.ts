import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  }
});

// Convenience methods for different log levels
export const log = {
  info: (message: string, data?: any) => {
    if (data) {
      logger.info(data, message);
    } else {
      logger.info(message);
    }
  },
  
  error: (message: string, error?: any) => {
    if (error) {
      logger.error(error, message);
    } else {
      logger.error(message);
    }
  },
  
  warn: (message: string, data?: any) => {
    if (data) {
      logger.warn(data, message);
    } else {
      logger.warn(message);
    }
  },
  
  debug: (message: string, data?: any) => {
    if (data) {
      logger.debug(data, message);
    } else {
      logger.debug(message);
    }
  }
};
