import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { attachments, expenses } from '../database/schema';
import { StorageService } from '../storage/storage.service';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const PDF_MIME_TYPE = 'application/pdf';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly storage: StorageService,
  ) {}

  async upload(userId: string, expenseId: string, file: Express.Multer.File, dto: UploadAttachmentDto) {
    await this.assertExpenseOwner(userId, expenseId);
    if (!file) {
      throw new BadRequestException('Attachment file is required');
    }

    const fileType = this.fileType(file.mimetype);
    const objectKey = await this.storage.uploadAttachment(file, userId, expenseId);

    try {
      const [attachment] = await this.drizzle.db
        .insert(attachments)
        .values({ expenseId, fileUrl: objectKey, fileType, label: dto.label })
        .returning();
      return this.toResponse(attachment);
    } catch (error) {
      await this.storage.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
  }

  async list(userId: string, expenseId: string) {
    await this.assertExpenseOwner(userId, expenseId);
    const rows = await this.drizzle.db
      .select()
      .from(attachments)
      .where(eq(attachments.expenseId, expenseId))
      .orderBy(desc(attachments.uploadedAt));
    return Promise.all(rows.map((attachment) => this.toResponse(attachment)));
  }

  async remove(userId: string, attachmentId: string) {
    const [attachment] = await this.drizzle.db
      .select({ id: attachments.id, fileUrl: attachments.fileUrl })
      .from(attachments)
      .innerJoin(expenses, eq(expenses.id, attachments.expenseId))
      .where(and(eq(attachments.id, attachmentId), eq(expenses.userId, userId)))
      .limit(1);

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    await this.storage.deleteObject(attachment.fileUrl);
    await this.drizzle.db.delete(attachments).where(eq(attachments.id, attachment.id));
    return { success: true };
  }

  private async toResponse(attachment: typeof attachments.$inferSelect) {
    const fileName = this.storage.fileNameFromKey(attachment.fileUrl);
    return {
      ...attachment,
      fileUrl: await this.storage.getSignedViewUrl(attachment.fileUrl, fileName),
      fileName,
    };
  }

  private fileType(mimeType: string): 'image' | 'pdf' {
    if (IMAGE_MIME_TYPES.has(mimeType)) return 'image';
    if (mimeType === PDF_MIME_TYPE) return 'pdf';
    throw new BadRequestException('Only JPG, PNG, WebP, GIF, and PDF files are supported');
  }

  private async assertExpenseOwner(userId: string, expenseId: string) {
    const [expense] = await this.drizzle.db
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
      .limit(1);
    if (!expense) throw new NotFoundException('Expense not found');
  }
}
