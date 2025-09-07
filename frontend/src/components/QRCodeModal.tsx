import QRCode from 'react-qr-code'
import { X, Copy } from 'lucide-react'

interface QRCodeModalProps {
  isOpen: boolean
  onClose: () => void
  roomCode: string
  roomName?: string
  roomId: string
}

export default function QRCodeModal({ isOpen, onClose, roomCode, roomName, roomId }: QRCodeModalProps) {
  if (!isOpen) return null

  const roomUrl = `${window.location.origin}/join/${roomCode}`

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const copyRoomCode = () => {
    copyToClipboard(roomCode)
  }

  const copyRoomUrl = () => {
    copyToClipboard(roomUrl)
  }

  const copyRoomId = () => {
    copyToClipboard(roomId)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Share Room
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Room Info */}
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {roomName || 'My Room'}
            </h3>
            <p className="text-sm text-gray-600">
              Scan the QR code or share the room code
            </p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
              <QRCode
                value={roomUrl}
                size={200}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
            </div>
          </div>

          {/* Room Code Display */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Room Code</p>
            <div className="flex items-center justify-center space-x-2">
              <span className="font-mono text-2xl font-bold text-gray-900 tracking-wider bg-gray-100 px-4 py-2 rounded-lg">
                {roomCode}
              </span>
              <button
                onClick={copyRoomCode}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                title="Copy room code"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Share Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700">Room URL</p>
                <p className="text-xs text-gray-500 truncate">{roomUrl}</p>
              </div>
              <button
                onClick={copyRoomUrl}
                className="ml-2 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                title="Copy room URL"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700">Room ID</p>
                <p className="text-xs text-gray-500 truncate">{roomId}</p>
              </div>
              <button
                onClick={copyRoomId}
                className="ml-2 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                title="Copy room ID"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">How to share:</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Share the QR code for easy mobile access</li>
              <li>• Share the room code for quick joining</li>
              <li>• Share the room URL for direct links</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
