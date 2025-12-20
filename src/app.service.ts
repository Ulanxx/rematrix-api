import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getWeather(query: string, debug?: boolean) {
    return {
      query,
      ok: true,
      debug: Boolean(debug),
    };
  }
}
