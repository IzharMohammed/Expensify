import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

  async uploadAttachment(file: Express.Multer.File, userId: string, expenseId: string) {
    const fileName = this.safeFileName(file.originalname);
    const key = `attachments/${userId}/${expenseId}/${randomUUID()}-${fileName}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return `s3://${this.bucket}/${key}`;
  }

  async getSignedViewUrl(objectLocation: string, fileName: string) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(objectLocation),
        ResponseContentDisposition: `inline; filename="${this.safeFileName(fileName)}"`,
      }),
      { expiresIn: 15 * 60 },
    );
  }

  async deleteObject(objectLocation: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(objectLocation) }),
    );
  }

  fileNameFromKey(key: string) {
    const value = key.split('/').at(-1) ?? 'attachment';
    return value.replace(/^[0-9a-f-]{36}-/i, '');
  }

  private safeFileName(value: string) {
    return value
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .slice(-120) || 'attachment';
  }

  private objectKey(objectLocation: string) {
    const prefix = `s3://${this.bucket}/`;
    return objectLocation.startsWith(prefix) ? objectLocation.slice(prefix.length) : objectLocation;
  }
}
