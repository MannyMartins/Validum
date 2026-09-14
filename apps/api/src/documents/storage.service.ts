import { Injectable, OnModuleInit } from '@nestjs/common';
import { S3Client, CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
@Injectable()
export class StorageService implements OnModuleInit {
  private client = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' } });
  private bucket = process.env.S3_BUCKET || 'documents';
  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (process.env.S3_CREATE_BUCKET !== 'true') {
        throw new Error(`No fue posible acceder al bucket S3 privado "${this.bucket}".`, { cause: error });
      }
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }
  async put(key: string, body: Buffer, contentType: string) { await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType })); return key; }
  signedReadUrl(key: string) { return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 900 }); }
}
