import { useState, useEffect } from 'react'
import { useWebSocket } from '@/lib/hooks/useWebSocket'

export default function WebSocketTest() {
  const [logs, setLogs] = useState<string[]>([])
  const [jobId, setJobId] = useState('test-job-123')

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const {
    connectionStatus,
    reconnectAttempts,
    connect,
    disconnect,
  } = useWebSocket({
    jobId,
    onJobStatusUpdate: (data) => {
      addLog(`📊 Job Status Update: ${data.status} (Stage: ${data.currentStage})`)
    },
    onStageCompleted: (data) => {
      addLog(`✅ Stage Completed: ${data.stage}${data.nextStage ? ` → Next: ${data.nextStage}` : ''}`)
    },
    onJobError: (data) => {
      addLog(`❌ Job Error: ${data.error}${data.stage ? ` (Stage: ${data.stage})` : ''}`)
    },
    onConnectionChange: (connected) => {
      addLog(connected ? '🟢 Connected to WebSocket' : '🔴 Disconnected from WebSocket')
    },
    onError: (error) => {
      addLog(`⚠️ WebSocket Error: ${error}`)
    },
  })

  const handleConnect = () => {
    addLog('🔌 Manually connecting...')
    connect()
  }

  const handleDisconnect = () => {
    addLog('🔌 Manually disconnecting...')
    disconnect()
  }

  const handleClearLogs = () => {
    setLogs([])
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600'
      case 'connecting': return 'text-yellow-600'
      case 'error': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected'
      case 'connecting': return 'Connecting...'
      case 'error': return 'Error'
      default: return 'Disconnected'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">WebSocket Integration Test</h1>
        
        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <div className="flex items-center gap-4">
            <div className={`font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </div>
            {reconnectAttempts > 0 && (
              <div className="text-sm text-orange-600">
                Reconnect attempts: {reconnectAttempts}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Controls</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job ID:
              </label>
              <input
                type="text"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter job ID"
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleConnect}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Connect
              </button>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Disconnect
              </button>
              <button
                onClick={handleClearLogs}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Clear Logs
              </button>
            </div>
          </div>
        </div>

        {/* Event Logs */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Event Logs</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded-md font-mono text-sm h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">No events yet. Connect to start receiving events...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">How to Test:</h3>
          <ol className="list-decimal list-inside text-blue-800 space-y-1">
            <li>Enter a job ID or use the default test ID</li>
            <li>Click "Connect" to establish WebSocket connection</li>
            <li>Watch the connection status change from "Connecting..." to "Connected"</li>
            <li>Trigger workflow events (run/pause/resume jobs) from the main app</li>
            <li>Observe real-time events in the log window</li>
            <li>Test reconnection by disconnecting/reconnecting or stopping the server</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
