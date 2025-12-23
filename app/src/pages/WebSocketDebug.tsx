import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';

export default function WebSocketDebug() {
  const [logs, setLogs] = useState<string[]>([]);
  const [jobId, setJobId] = useState('debug-job-123');

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const {
    connectionStatus,
    reconnectAttempts,
    connect,
    disconnect,
  } = useWebSocket({
    jobId,
    onJobStatusUpdate: (data) => {
      addLog(`状态更新: ${data.status} (${data.currentStage})`);
    },
    onStageCompleted: (data) => {
      addLog(`阶段完成: ${data.stage} -> ${data.nextStage}`);
    },
    onJobError: (data) => {
      addLog(`错误: ${data.error} (${data.stage})`);
    },
    onConnectionChange: (connected) => {
      addLog(`连接状态变化: ${connected ? '已连接' : '已断开'}`);
    },
    onError: (error) => {
      addLog(`WebSocket 错误: ${error}`);
    },
  });

  const handleConnect = () => {
    addLog('手动触发连接...');
    connect();
  };

  const handleDisconnect = () => {
    addLog('手动断开连接...');
    disconnect();
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">WebSocket 连接调试</h1>
      
      {/* 连接状态 */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-3">连接状态</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium">状态: </span>
            <span className={`px-2 py-1 rounded text-sm ${
              connectionStatus === 'connected' ? 'bg-green-200 text-green-800' :
              connectionStatus === 'connecting' ? 'bg-yellow-200 text-yellow-800' :
              connectionStatus === 'error' ? 'bg-red-200 text-red-800' :
              'bg-gray-200 text-gray-800'
            }`}>
              {connectionStatus}
            </span>
          </div>
          <div>
            <span className="font-medium">重连次数: </span>
            <span>{reconnectAttempts}</span>
          </div>
        </div>
      </div>

      {/* 控制面板 */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-3">控制面板</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="text"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="Job ID"
            className="px-3 py-2 border rounded"
          />
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            连接
          </button>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            断开
          </button>
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            清空日志
          </button>
        </div>
      </div>

      {/* 日志输出 */}
      <div className="bg-gray-900 text-green-400 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-3 text-white">连接日志</h2>
        <div className="font-mono text-sm max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500">暂无日志...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 说明 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">使用说明</h3>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>页面加载时会自动尝试连接 WebSocket</li>
          <li>绿色状态表示连接成功，黄色表示连接中，红色表示错误</li>
          <li>如果连接失败，会自动尝试重连（最多5次）</li>
          <li>可以手动修改 Job ID 来测试不同房间的连接</li>
          <li>查看控制台日志获取更详细的连接信息</li>
        </ul>
      </div>
    </div>
  );
}
