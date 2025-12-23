const WebSocket = require('ws');

// WebSocket 测试脚本
console.log('🧪 开始 WebSocket 连接测试...');

// 连接到 WebSocket 服务器，确保 token 正确编码
const token = 'demo-token';
const wsUrl = `ws://localhost:3000/ws?token=${encodeURIComponent(token)}`;
console.log('🔗 连接 URL:', wsUrl);

const ws = new WebSocket(wsUrl);

ws.on('open', function open() {
  console.log('✅ WebSocket 连接成功');
  
  // 发送加入 job 房间的消息
  const joinMessage = {
    type: 'join_job',
    jobId: 'test-job-123'
  };
  
  console.log('📤 发送加入房间消息:', joinMessage);
  ws.send(JSON.stringify(joinMessage));
});

ws.on('message', function message(data) {
  try {
    const parsed = JSON.parse(data);
    console.log('📥 收到消息:', parsed);
    
    switch (parsed.type) {
      case 'connection_established':
        console.log('🎉 连接已建立');
        break;
      case 'job_status':
        console.log('📊 Job 状态更新:', parsed.data);
        break;
      case 'stage_completed':
        console.log('✅ 阶段完成:', parsed.data);
        break;
      case 'job_error':
        console.log('❌ Job 错误:', parsed.data);
        break;
      case 'error':
        console.log('⚠️ 服务器错误:', parsed.message);
        break;
      default:
        console.log('❓ 未知消息类型:', parsed.type);
    }
  } catch (error) {
    console.log('📥 原始消息:', data.toString());
  }
});

ws.on('close', function close(code, reason) {
  console.log(`🔌 WebSocket 连接关闭: ${code} - ${reason}`);
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket 错误:', err.message);
});

// 5秒后发送心跳测试
setTimeout(() => {
  console.log('💓 发送心跳测试...');
  ws.send(JSON.stringify({ type: 'ping' }));
}, 5000);

// 10秒后测试离开房间
setTimeout(() => {
  console.log('🚪 发送离开房间消息...');
  ws.send(JSON.stringify({
    type: 'leave_job',
    jobId: 'test-job-123'
  }));
}, 10000);

// 15秒后关闭连接
setTimeout(() => {
  console.log('🔚 关闭连接...');
  ws.close();
}, 15000);

console.log('⏳ 等待连接建立...');
