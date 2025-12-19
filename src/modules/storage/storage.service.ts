import { Injectable } from '@nestjs/common';
import {
  deleteFromBunny,
  uploadBufferToBunny,
  uploadJsonToBunny,
} from '../../utils/bunny-storage';

@Injectable()
export class StorageService {
  uploadJson(params: { path: string; json: unknown }) {
    return uploadJsonToBunny(params);
  }

  uploadBuffer(params: {
    path: string;
    contentType: string;
    data: Uint8Array;
  }) {
    return uploadBufferToBunny(params);
  }

  delete(params: { path: string }) {
    return deleteFromBunny(params);
  }
}
