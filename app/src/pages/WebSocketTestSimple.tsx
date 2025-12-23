import { useState, useEffect } from 'react'

export default function WebSocketTestSimple() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000/ws?token=demo-token')
    
    ws.onopen = () => {
      console.log('WebSocket connected')
      setStatus('connected')
      setMessage('Connected successfully!')
      
      // 发送测试消息
      ws.send(JSON.stringify({
        type: 'join_job',
        jobId: 'test-job-123'
      }))
    }
    
    ws.onmessage = (event) => {
      console.log('Received message:', event.data)
      setMessage(`Received: ${event.data}`)
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setStatus('error')
      setMessage('Connection error')
    }
    
    ws.onclose = () => {
      console.log('WebSocket closed')
      setStatus('disconnected')
      setMessage('Connection closed')
    }

    return () => {
      ws.close()
    }
  }, [])

  return (
    <div style={{ padding: '20px' }}>
      <h1>WebSocket Test</h1>
      <p>Status: <strong>{status}</strong></p>
      <p>Message: {message}</p>
    </div>
  )
}
