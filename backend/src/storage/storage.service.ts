import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly region: string;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.getOrThrow<string>('AWS_REGION');
    this.bucket = this.configService.getOrThrow<string>('AWS_S3_BUCKET');
    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  async uploadReceipt(file: Express.Multer.File) {
    const key = `receipts/${randomUUID()}-${file.originalname.replace(/\s+/g, '-')}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
