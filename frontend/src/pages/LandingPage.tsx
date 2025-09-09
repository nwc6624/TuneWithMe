import { useAuth } from '../contexts/AuthContext'
import { Music, Users, Radio, Play, Headphones } from 'lucide-react'

export default function LandingPage() {
  const { login } = useAuth()

  return (
    <div className="min-h-screen bg-primary">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-bg-primary to-bg-secondary" />
        
        {/* Floating elements */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-primary-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-40 h-40 bg-primary-600/20 rounded-full blur-3xl" />
        
        <div className="relative z-10 container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            {/* Logo and Title */}
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl mb-6 shadow-lg">
                <Music className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-6xl font-bold text-high-contrast mb-4">
                TuneWith
                <span className="gradient-text">Me</span>
              </h1>
              <p className="text-xl text-medium-contrast font-medium max-w-2xl mx-auto">
                Sync your Spotify playback with streamers and friends in real-time. 
                No rebroadcasted audio - everyone listens locally while staying perfectly in sync.
              </p>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500/20 rounded-xl mb-4">
                  <Radio className="w-8 h-8 text-primary-400" />
                </div>
                <h3 className="text-lg font-bold text-high-contrast mb-2">Real-time Sync</h3>
                <p className="text-medium-contrast font-medium">
                  Perfect synchronization with sub-second accuracy
                </p>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500/20 rounded-xl mb-4">
                  <Users className="w-8 h-8 text-primary-400" />
                </div>
                <h3 className="text-lg font-bold text-high-contrast mb-2">Multi-platform</h3>
                <p className="text-medium-contrast font-medium">
                  Works on desktop, iOS, and Android
                </p>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500/20 rounded-xl mb-4">
                  <Headphones className="w-8 h-8 text-primary-400" />
                </div>
                <h3 className="text-lg font-bold text-high-contrast mb-2">Premium Quality</h3>
                <p className="text-medium-contrast font-medium">
                  Full Spotify Premium audio quality for everyone
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => login('host')}
                className="btn-primary text-lg px-8 py-4 hover-lift group"
              >
                <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Start Sharing
              </button>
              
              <button
                onClick={() => login('viewer')}
                className="btn-outline text-lg px-8 py-4 hover-lift group"
              >
                <Headphones className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Join a Room
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* How it works section */}
      <div className="py-20 bg-background-secondary" style={{ backgroundColor: '#f0f4f8' }}>
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center text-extra-high-contrast mb-16" style={{ color: '#000000', fontWeight: '900' }}>
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Host side */}
            <div>
              <h3 className="text-2xl font-semibold text-extra-high-contrast mb-6 flex items-center" style={{ color: '#000000', fontWeight: '800' }}>
                <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  1
                </div>
                For Streamers & Hosts
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-high-contrast" style={{ color: '#000000', fontWeight: '700' }}>
                    Connect your Spotify Premium account
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-high-contrast" style={{ color: '#000000', fontWeight: '700' }}>
                    Create a room and start sharing
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-high-contrast" style={{ color: '#000000', fontWeight: '700' }}>
                    Listen normally - we'll sync everyone else
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-high-contrast" style={{ color: '#000000', fontWeight: '700' }}>
                    Get OBS overlay URL for your stream
                  </p>
                </div>
              </div>
            </div>

            {/* Viewer side */}
            <div>
              <h3 className="text-2xl font-semibold text-extra-high-contrast mb-6 flex items-center" style={{ color: '#000000', fontWeight: '800' }}>
                <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  2
                </div>
                For Viewers & Friends
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-high-contrast" style={{ color: '#000000', fontWeight: '700' }}>
                    Connect your Spotify Premium account
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-high-contrast" style={{ color: '#000000', fontWeight: '700' }}>
                    Join a room with the room ID
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-high-contrast" style={{ color: '#000000', fontWeight: '700' }}>
                    Choose your preferred device
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-high-contrast" style={{ color: '#000000', fontWeight: '700' }}>
                    Enjoy perfectly synced music
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-12 bg-background-primary border-t border-surface-tertiary/20" style={{ backgroundColor: '#f0f4f8' }}>
        <div className="container mx-auto px-4 text-center">
          <p className="text-high-contrast" style={{ color: '#000000', fontWeight: '700' }}>
            © 2024 TuneWithMe. Built with ❤️ for music lovers and streamers.
          </p>
          <p className="text-sm text-medium-contrast mt-2" style={{ color: '#000000', fontWeight: '600' }}>
            Requires Spotify Premium accounts for all participants.
          </p>
        </div>
      </div>
    </div>
  )
}
