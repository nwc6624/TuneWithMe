# TuneWithMe 🎵

A real-time Spotify synchronization platform that lets streamers share their current track and keep viewers' playback perfectly synced on their own Spotify Premium accounts. No rebroadcasted audio - everyone listens locally while staying in perfect sync.

## ✨ Features

- **Real-time Sync**: Sub-second accuracy synchronization between host and viewers
- **Multi-platform**: Desktop web, iOS, and Android support
- **Premium Quality**: Full Spotify Premium audio quality for all participants
- **OBS Integration**: Beautiful "Now Playing" overlay for streamers
- **Device Management**: Choose your preferred Spotify device
- **No Audio Rebroadcasting**: Everyone listens through their own Spotify accounts

## 🏗️ Architecture

- **Backend**: Node.js + TypeScript + Fastify
- 
- 
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Real-time**: WebSocket + Redis pub/sub
- **Database**: Redis for ephemeral state, PostgreSQL optional for persistence
- **Authentication**: Spotify OAuth 2.0 with PKCE

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Redis server
- Spotify Developer account
- npm or yarn

### 1. Clone and Install

```bash
git clone <repository-url>
cd TuneWithMe
npm install
```

### 2. Environment Setup

#### Backend Environment

Copy the backend environment template:

```bash
cd backend
cp env.example .env
```

Edit `.env` with your configuration:

```env
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

#### Frontend Environment

The frontend will automatically proxy API calls to the backend.

### 3. Spotify App Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add redirect URI: `http://localhost:3001/auth/spotify/callback`
4. Copy Client ID and Client Secret to your `.env` file

### 4. Start Redis

```bash
# macOS (using Homebrew)
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis

# Or using Docker
docker run -d -p 6379:6379 redis:alpine
```

### 5. Start Development Servers

```bash
# Start both backend and frontend
npm run dev

# Or start individually
npm run dev:backend  # Backend on port 3001
npm run dev:frontend # Frontend on port 3000
```

### 6. Open Your Browser

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/health

## 🎯 Usage

### For Streamers (Hosts)

1. Visit the landing page and click "Start Sharing"
2. Authenticate with your Spotify Premium account
3. Create a room and start sharing
4. Play music normally on Spotify
5. Share the room ID with your viewers
6. Use the OBS overlay URL for your stream

### For Viewers

1. Get a room ID from the host
2. Visit the landing page and click "Join a Room"
3. Authenticate with your Spotify Premium account
4. Select your preferred device
5. Enter the room ID and start syncing
6. Your playback will automatically sync with the host

## 🔧 Development

### Project Structure

```
TuneWithMe/
├── backend/                 # Node.js backend server
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── websocket/      # WebSocket handling
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utilities
│   ├── package.json
│   └── tsconfig.json
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   └── types/          # TypeScript types
│   ├── package.json
│   └── vite.config.ts
└── package.json             # Root workspace config
```

### Available Scripts

```bash
# Development
npm run dev              # Start both servers
npm run dev:backend      # Start backend only
npm run dev:frontend     # Start frontend only

# Building
npm run build            # Build both projects
npm run build:backend    # Build backend only
npm run build:frontend   # Build frontend only

# Production
npm run start            # Start production backend

# Quality
npm run lint             # Lint all projects
npm run test             # Run tests
```

### API Endpoints

#### Authentication
- `GET /auth/spotify/start?role=host|viewer` - Start OAuth flow
- `GET /auth/spotify/callback` - OAuth callback
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user
- `POST /auth/refresh` - Refresh tokens

#### Rooms
- `POST /rooms` - Create room
- `POST /rooms/:id/join` - Join room
- `POST /rooms/:id/leave` - Leave room
- `POST /rooms/:id/start` - Start sharing
- `POST /rooms/:id/stop` - Stop sharing
- `GET /rooms/:id/state` - Get room state
- `GET /rooms/:id/members` - Get room members

#### WebSocket
- `WS /ws/rooms/:id` - Join room WebSocket channel

#### Overlay
- `GET /overlay/:room_id` - OBS overlay HTML
- `GET /overlay/:room_id/data` - Overlay data JSON
- `GET /overlay/:room_id/style.css` - Overlay styles

### WebSocket Messages

#### From Server
- `NOW_PLAYING` - Current playback state
- `CONTROL` - Playback control commands
- `MEMBER_JOIN` - New member joined
- `MEMBER_LEAVE` - Member left
- `CONNECTED` - Connection established

#### From Client
- `SYNC_REQUEST` - Request current state
- `CONTROL` - Send control command

## 🧪 Testing

```bash
# Run backend tests
cd backend
npm test

# Run frontend tests
cd frontend
npm test

# Run all tests
npm test
```

## 🚀 Deployment

### Backend Deployment

1. Build the project:
   ```bash
   npm run build:backend
   ```

2. Set production environment variables
3. Deploy to your preferred platform:
   - Heroku
   - Railway
   - Render
   - DigitalOcean App Platform
   - AWS/GCP/Azure

### Frontend Deployment

1. Build the project:
   ```bash
   npm run build:frontend
   ```

2. Deploy the `dist` folder to:
   - Vercel
   - Netlify
   - GitHub Pages
   - Any static hosting service

### Environment Variables

Update your production environment with:
- Production Spotify redirect URIs
- Production Redis connection
- Secure session secrets
- Production CORS origins

## 🔒 Security Considerations

- HTTPS everywhere in production
- Secure session cookies
- OAuth state parameter validation
- Rate limiting on API endpoints
- Input validation and sanitization
- No sensitive data in logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Spotify Web API for music integration
- Fastify for the blazing-fast backend
- React for the beautiful frontend
- Redis for real-time communication
- All contributors and supporters

## 📞 Support

- Create an issue for bugs or feature requests
- Check the documentation for common questions
- Join our community discussions

---

**Note**: This project requires Spotify Premium accounts for all participants to enable playback control features.
