export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

export interface UploadResult {
  key: string;
  url: string;
}

export interface StorageProvider {
  upload(params: {
    key: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<UploadResult>;

  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;

  delete(key: string): Promise<void>;
}
