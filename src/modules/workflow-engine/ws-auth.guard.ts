import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Socket } from 'ws';

@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    const token = this.extractTokenFromClient(client);

    if (!token) {
      client.send(
        JSON.stringify({
          type: 'error',
          message: 'Authentication token required',
          code: 'UNAUTHORIZED',
          timestamp: new Date().toISOString(),
        }),
      );
      return false;
    }

    // 简单的 token 验证（在生产环境中应该使用 JWT 验证）
    if (token !== process.env.WS_AUTH_TOKEN && token !== 'demo-token') {
      client.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid authentication token',
          code: 'FORBIDDEN',
          timestamp: new Date().toISOString(),
        }),
      );
      return false;
    }

    return true;
  }

  private extractTokenFromClient(client: Socket): string | null {
    // 尝试从查询参数中获取 token
    const url = new URL(client.url || '', 'http://localhost');
    return url.searchParams.get('token');
  }
}
