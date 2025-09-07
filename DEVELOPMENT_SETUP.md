# TuneWithMe Development Setup Guide

## Prerequisites
- Node.js 18+ 
- npm or yarn
- Redis server
- Spotify Developer Account

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd TuneWithMe
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   # Copy the example environment file
   cp backend/env.example backend/.env
   
   # Edit backend/.env with your values
   ```

3. **Start Redis:**
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:alpine
   
   # Or install locally
   # macOS: brew install redis && brew services start redis
   # Ubuntu: sudo apt install redis-server && sudo systemctl start redis
   ```

4. **Start development servers:**
   ```bash
   npm run dev
   ```

This will start:
- Backend on http://localhost:3001
- Frontend on http://localhost:3000

## Environment Configuration

### Backend (.env)
```bash
# Spotify OAuth Configuration
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3001/auth/spotify/callback

# Server Configuration
PORT=3001
NODE_ENV=development

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Session Secret (generate a random string)
SESSION_SECRET=your_session_secret_here

# CORS Origins
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Spotify OAuth Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add redirect URI: `http://localhost:3001/auth/spotify/callback`
4. Copy Client ID and Client Secret to your `.env` file

## Development Commands

```bash
# Start all services
npm run dev

# Start only backend
npm run dev:backend

# Start only frontend
npm run dev:frontend

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## Project Structure

```
TuneWithMe/
├── backend/                 # Node.js/TypeScript backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── websocket/      # WebSocket handling
│   │   └── types/          # TypeScript types
│   └── Dockerfile.dev      # Development Docker setup
├── frontend/               # React/TypeScript frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   └── main.tsx        # App entry point
│   └── vite.config.ts      # Vite configuration
├── docker-compose.yml      # Development Docker setup
└── package.json           # Root package.json
```

## Development Workflow

1. **Make changes to code**
2. **Hot reload will automatically restart services**
3. **Check browser console for frontend errors**
4. **Check terminal for backend errors**
5. **Test functionality in browser**

## Testing

### Manual Testing Checklist

- [ ] User can authenticate with Spotify
- [ ] Host can create a room
- [ ] Host can start/stop sharing
- [ ] Viewer can join a room
- [ ] Playback state syncs between host and viewers
- [ ] WebSocket connection works
- [ ] OBS overlay displays correctly

### API Testing

Use the health check endpoint:
```bash
curl http://localhost:3001/health
```

## Debugging

### Backend Issues
- Check terminal output for errors
- Use `console.log()` for debugging
- Check Redis connection: `redis-cli ping`

### Frontend Issues
- Check browser developer tools
- Look for network errors in Network tab
- Check console for JavaScript errors

### WebSocket Issues
- Check browser Network tab for WebSocket connection
- Verify backend WebSocket logs
- Test with WebSocket testing tools

## Common Issues

### "Redis connection failed"
- Ensure Redis is running
- Check REDIS_URL in .env
- Verify Redis is accessible on port 6379

### "Spotify OAuth failed"
- Check client ID and secret
- Verify redirect URI matches exactly
- Ensure Spotify app is not in development mode

### "WebSocket connection failed"
- Check if backend is running
- Verify WebSocket URL in frontend
- Check for CORS issues

### "Build failed"
- Run `npm install` to ensure dependencies are installed
- Check for TypeScript errors
- Verify all environment variables are set

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Run linting: `npm run lint`
5. Create a pull request

## Performance Tips

- Use Redis for caching
- Implement proper error handling
- Use TypeScript for type safety
- Follow React best practices
- Optimize bundle size with Vite

## Security Considerations

- Never commit .env files
- Use strong session secrets
- Validate all inputs
- Implement rate limiting
- Use HTTPS in production
