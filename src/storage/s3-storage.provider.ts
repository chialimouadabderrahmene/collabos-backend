import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider, UploadResult } from './storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('storage.s3Bucket') as string;
    this.publicBaseUrl = this.configService.get<string>(
      'storage.s3PublicBaseUrl',
    );
    const endpoint = this.configService.get<string>('storage.s3Endpoint');

    this.client = new S3Client({
      region: this.configService.get<string>('storage.s3Region'),
      endpoint,
      // Path-style addressing is required by R2 and most S3-compatible
      // providers when using a custom endpoint; real S3 works either way.
      forcePathStyle: !!endpoint,
      credentials: {
        accessKeyId: this.configService.get<string>(
          'storage.s3AccessKeyId',
        ) as string,
        secretAccessKey: this.configService.get<string>(
          'storage.s3SecretAccessKey',
        ) as string,
      },
    });
  }

  async upload(params: {
    key: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType,
      }),
    );

    const url = this.publicBaseUrl
      ? `${this.publicBaseUrl}/${params.key}`
      : await this.getSignedUrl(params.key, 3600);

    return { key: params.key, url };
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
