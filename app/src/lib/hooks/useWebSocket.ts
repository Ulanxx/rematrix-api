import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketMessage {
  type: string;
  data?: unknown;
  timestamp: string;
  clientId?: string;
  message?: string;
  code?: string;
  heartbeatInterval?: number;
}

export interface JobStatusUpdateData {
  jobId: string;
  status: string;
  currentStage: string;
  completedStages: string[];
  timestamp: string;
  progress?: number;
  error?: string;
}

export interface StageCompletedData {
  jobId: string;
  stage: string;
  nextStage?: string;
  timestamp: string;
}

export interface JobErrorData {
  jobId: string;
  error: string;
  stage?: string;
  timestamp: string;
}

export interface UseWebSocketOptions {
  jobId: string;
  token?: string;
  onJobStatusUpdate?: (data: JobStatusUpdateData) => void;
  onStageCompleted?: (data: StageCompletedData) => void;
  onJobError?: (data: JobErrorData) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: string) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export const useWebSocket = (options: UseWebSocketOptions) => {
  const {
    jobId,
    token = 'demo-token',
    onJobStatusUpdate,
    onStageCompleted,
    onJobError,
    onConnectionChange,
    onError,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const messageHandlersRef = useRef<Map<string, (data: unknown) => void>>(
    new Map(),
  );

  // 清理连接
  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // 处理 WebSocket 消息
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'connection_established': {
            setIsConnected(true);
            setConnectionStatus('connected');
            onConnectionChange?.(true);
            break;
          }

          case 'job_status_update':
            onJobStatusUpdate?.(message.data as JobStatusUpdateData);
            break;

          case 'stage_completed':
            onStageCompleted?.(message.data as StageCompletedData);
            break;

          case 'job_error':
            onJobError?.(message.data as JobErrorData);
            break;

          case 'heartbeat_request':
            // 发送 pong 响应
            wsRef.current?.send(JSON.stringify({ type: 'pong' }));
            break;

          case 'pong':
            // 心跳响应，无需处理
            break;

          case 'error':
            onError?.(message.message || 'Unknown WebSocket error');
            break;

          default: {
            // 调用自定义消息处理器
            const handler = messageHandlersRef.current.get(message.type);
            if (handler) {
              handler(message.data);
            }
            break;
          }
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
        onError?.('Failed to parse server message');
      }
    },
    [
      onJobStatusUpdate,
      onStageCompleted,
      onJobError,
      onConnectionChange,
      onError,
    ],
  );

  // 连接 WebSocket 函数
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    cleanup();
    setIsConnected(false);
    setConnectionStatus('connecting');

    try {
      // 修复：连接到后端服务器的端口 3000，而不是前端端口
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//localhost:3000/ws?token=${encodeURIComponent(token)}`;
      console.log('Connecting to WebSocket:', wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setReconnectAttempts(0);

        // 加入 job 房间
        wsRef.current?.send(
          JSON.stringify({
            type: 'join_job',
            jobId,
          }),
        );
      };

      wsRef.current.onmessage = handleMessage;

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        onConnectionChange?.(false);

        // 如果不是正常关闭，尝试重连
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          const nextAttempt = reconnectAttempts + 1;
          setReconnectAttempts(nextAttempt);

          console.log(
            `Attempting to reconnect (${nextAttempt}/${maxReconnectAttempts}) in ${reconnectInterval}ms`,
          );

          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.log(
            'Max reconnection attempts reached, stopping reconnection',
          );
          setConnectionStatus('error');
          onError?.('Max reconnection attempts reached');
        }
      };

      wsRef.current.onerror = (error) => {
        // console.error('WebSocket error:', error);
        setConnectionStatus('error');
        onError?.('WebSocket connection error');
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
      onError?.('Failed to create WebSocket connection');
    }
  }, [
    jobId,
    token,
    reconnectAttempts,
    maxReconnectAttempts,
    reconnectInterval,
    cleanup,
    handleMessage,
    onConnectionChange,
    onError,
  ]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      // 离开 job 房间
      wsRef.current.send(
        JSON.stringify({
          type: 'leave_job',
          jobId,
        }),
      );
    }

    cleanup();
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setReconnectAttempts(0);
  }, [jobId, cleanup]);

  // 发送消息
  const sendMessage = useCallback((type: string, data?: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    } else {
      console.warn('WebSocket is not connected, cannot send message');
    }
  }, []);

  // 注册自定义消息处理器
  const registerMessageHandler = useCallback(
    (type: string, handler: (data: unknown) => void) => {
      messageHandlersRef.current.set(type, handler);
    },
    [],
  );

  // 注销消息处理器
  const unregisterMessageHandler = useCallback((type: string) => {
    messageHandlersRef.current.delete(type);
  }, []);

  // 组件挂载时连接，卸载时清理
  useEffect(() => {
    // 延迟连接，避免组件快速卸载时的连接问题
    const connectTimeout = setTimeout(() => {
      connect();
    }, 100);

    return () => {
      clearTimeout(connectTimeout);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载/卸载时运行

  return {
    isConnected,
    connectionStatus,
    reconnectAttempts,
    connect,
    disconnect,
    sendMessage,
    registerMessageHandler,
    unregisterMessageHandler,
  };
};
