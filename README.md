# TuneWithMe 🎵

A real-time Spotify synchronization platform that lets streamers share their current track and keep viewers' playback perfectly synced on their own Spotify Premium accounts. No rebroadcasted audio - everyone listens locally while staying in perfect sync.

## ✨ Features



### Core Functionality
- **Real-time Sync**: Sub-second accuracy synchronization between host and viewers
- **Premium Quality**: Full Spotify Premium audio quality for all participants
- **No Audio Rebroadcasting**: Everyone listens through their own Spotify accounts
- **Device Management**: Choose your preferred Spotify device for playback

### User Experience
- **Public Room Discovery**: Browse and join public listening sessions
- **QR Code Sharing**: Easy room sharing with QR codes
- **Responsive Design**: Modern, accessible UI with dark/light theme support
- **Real-time Updates**: Live member count and room status updates

### Streamer Tools
- **OBS Integration**: Beautiful "Now Playing" overlay for streamers
- **Host Dashboard**: Comprehensive control panel for room management
- **Room Analytics**: Track member count and session duration
- **Overlay Customization**: Styled overlay with current track information

### Technical Features
- **WebSocket Communication**: Real-time bidirectional communication
- **Redis Pub/Sub**: Scalable real-time message distribution
- **Spotify Web API**: Full integration with Spotify's playback controls
- **Session Management**: Secure OAuth 2.0 authentication flow

## 🏗️ Architecture

### Backend Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Fastify (high-performance web framework)
- **Real-time**: WebSocket + Redis pub/sub messaging
- **Authentication**: Spotify OAuth 2.0 with session management
- **Logging**: Pino (structured logging)
- **Validation**: Zod (runtime type validation)
- **Database**: Redis (ephemeral state management)

### Frontend Stack
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite (fast development and building)
- **Styling**: Tailwind CSS + custom CSS variables
- **Routing**: React Router DOM
- **Icons**: Lucide React
- **QR Codes**: React QR Code + qrcode library
- **State Management**: React Context API

### Key Dependencies
- **Backend**: `@fastify/websocket`, `@fastify/session`, `spotify-web-api-node`, `redis`
- **Frontend**: `react-router-dom`, `lucide-react`, `tailwind-merge`, `clsx`

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
│   │   ├── routes/         # API routes (auth, rooms, overlay)
│   │   ├── services/       # Business logic (spotify, redis, hostPoller)
│   │   ├── websocket/      # WebSocket handling
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utilities (logger)
│   ├── dist/               # Compiled JavaScript
│   ├── package.json
│   └── tsconfig.json
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components (Layout, LoadingSpinner, QRCodeModal)
│   │   ├── contexts/       # React contexts (Auth, Room, Theme)
│   │   ├── pages/          # Page components (Landing, HostDashboard, ViewerInterface, etc.)
│   │   ├── index.css       # Global styles with CSS variables
│   │   └── main.tsx        # App entry point
│   ├── dist/               # Built static files
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml       # Development environment
├── docker-compose.prod.yml  # Production environment
└── package.json             # Root workspace config
```

### Current Pages & Components

#### Pages
- **LandingPage**: Welcome screen with feature overview and navigation
- **HostDashboard**: Streamer control panel with room management
- **ViewerInterface**: Listener interface with sync controls
- **JoinRoom**: Room joining flow with device selection
- **PublicRooms**: Browse and discover public listening sessions

#### Components
- **Layout**: Main app layout with navigation
- **LoadingSpinner**: Reusable loading indicator
- **QRCodeModal**: QR code generation for room sharing

#### Contexts
- **AuthContext**: Spotify authentication state management
- **RoomContext**: Room state and WebSocket communication
- **ThemeContext**: Dark/light theme switching

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

#### Authentication (`/auth`)
- `GET /auth/spotify/start?role=host|viewer` - Start OAuth flow
- `GET /auth/spotify/callback` - OAuth callback
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user
- `POST /auth/refresh` - Refresh tokens

#### Rooms (`/rooms`)
- `POST /rooms` - Create room
- `POST /rooms/:id/join` - Join room
- `POST /rooms/:id/leave` - Leave room
- `POST /rooms/:id/start` - Start sharing
- `POST /rooms/:id/stop` - Stop sharing
- `GET /rooms/:id/state` - Get room state
- `GET /rooms/:id/members` - Get room members
- `GET /rooms/public` - Get public rooms list

#### WebSocket
- `WS /ws/rooms/:id` - Join room WebSocket channel

#### Overlay (`/overlay`)
- `GET /overlay/:room_id` - OBS overlay HTML
- `GET /overlay/:room_id/data` - Overlay data JSON
- `GET /overlay/:room_id/style.css` - Overlay styles

#### Health Check
- `GET /health` - Server health status

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

## 🆕 Recent Updates

### Latest Improvements
- **CSS Architecture**: Moved inline styles to external CSS classes for better maintainability
- **Theme System**: Enhanced dark/light theme support with CSS variables
- **Public Rooms**: Added discovery feature for public listening sessions
- **QR Code Sharing**: Implemented QR code generation for easy room sharing
- **Responsive Design**: Improved mobile and desktop experience
- **Code Quality**: Reduced linter warnings and improved code organization

### Performance Optimizations
- **WebSocket Efficiency**: Optimized real-time communication
- **Redis Integration**: Enhanced pub/sub messaging for scalability
- **Frontend Build**: Improved Vite configuration for faster builds
- **Type Safety**: Enhanced TypeScript coverage across the codebase

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Use Tailwind CSS for styling
- Maintain responsive design principles
- Test WebSocket functionality thoroughly
- Ensure Spotify API integration works correctly

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

**Screenshots**

--OBS plugin example 
<img width="1152" height="781" alt="Screenshot 2025-09-02 at 10 57 35 PM" src="https://github.com/user-attachments/assets/8c17d89d-8075-4c41-8b60-020a7006a140" />
