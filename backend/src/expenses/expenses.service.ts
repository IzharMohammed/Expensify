import { BadRequestException, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { CategoriesService } from '../categories/categories.service';
import { DrizzleService } from '../database/drizzle.service';
import { expenses } from '../database/schema';
import { StorageService } from '../storage/storage.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { GroqService } from './groq.service';
import { ExpensePreview, ParsedReceiptDraft } from './types/expense.types';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly categoriesService: CategoriesService,
    private readonly groqService: GroqService,
    private readonly storageService: StorageService,
  ) {}

  async parseText(userId: string, text: string): Promise<{ preview: ExpensePreview }> {
    const categories = await this.categoriesService.listForUser(userId);
    const parsed = await this.groqService.parseExpenseText({
      text,
      categoryNames: categories.map((category) => category.name),
      todayIsoDate: this.todayIso(),
    });

    const matchedCategory = parsed.category
      ? await this.categoriesService.findByNameForUser(userId, parsed.category)
      : null;

    return {
      preview: {
        merchant: parsed.merchant ?? 'Unknown merchant',
        amount: parsed.amount,
        category: matchedCategory,
        categoryName: parsed.category ?? null,
        paymentMethod: parsed.payment_method ?? null,
        date: parsed.date ?? this.todayIso(),
        note: parsed.note ?? null,
        source: 'text',
        rawInput: text,
      },
    };
  }

  async createExpense(userId: string, dto: CreateExpenseDto) {
    if (!dto.categoryId) {
      throw new BadRequestException('Category is required');
    }

    const category = dto.categoryId
      ? await this.categoriesService.findAccessibleById(userId, dto.categoryId)
      : null;

    if (dto.categoryId && !category) {
      throw new BadRequestException('Invalid category');
    }

    const [expense] = await this.drizzle.db
      .insert(expenses)
      .values({
        userId,
        amount: dto.amount,
        merchant: dto.merchant.trim(),
        categoryId: category?.id ?? null,
        paymentMethod: dto.paymentMethod ?? null,
        date: new Date(dto.date),
        note: dto.note ?? null,
        source: dto.source,
        rawInput: dto.rawInput ?? null,
        receiptUrl: dto.receiptUrl ?? null,
      })
      .returning();

    return { expense };
  }

  async parseVoice(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    const transcript = await this.groqService.transcribeAudio(file);
    const result = await this.parseText(userId, transcript);

    return {
      transcript,
      preview: {
        ...result.preview,
        source: 'voice' as const,
        rawInput: transcript,
      },
    };
  }

  async parseReceipt(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Receipt file is required');
    }

    const categories = await this.categoriesService.listForUser(userId);
    const receiptUrl = await this.storageService.uploadReceipt(file);
    const extractedText = await this.groqService.extractTextFromReceipt(file);
    const parsed = await this.groqService.parseReceipt({
      text: extractedText,
      categoryNames: categories.map((category) => category.name),
      todayIsoDate: this.todayIso(),
    });
    const matchedCategory = parsed.category
      ? await this.categoriesService.findByNameForUser(userId, parsed.category)
      : null;

    return {
      receiptUrl,
      extractedText,
      receipt: parsed,
      preview: this.toReceiptPreview(parsed, matchedCategory, extractedText, receiptUrl),
    };
  }

  async listRecent(userId: string) {
    return this.drizzle.db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(desc(expenses.date), desc(expenses.createdAt))
      .limit(10);
  }

  private toReceiptPreview(
    parsed: ParsedReceiptDraft,
    matchedCategory: Awaited<ReturnType<CategoriesService['findByNameForUser']>>,
    extractedText: string,
    receiptUrl: string,
  ): ExpensePreview {
    return {
      merchant: parsed.store ?? 'Receipt import',
      amount: parsed.total_amount,
      category: matchedCategory,
      categoryName: parsed.category ?? null,
      paymentMethod: null,
      date: parsed.date ?? this.todayIso(),
      note: parsed.gst_amount ? `GST ${parsed.gst_amount}` : null,
      source: 'ocr',
      rawInput: extractedText,
      receiptUrl,
      gstAmount: parsed.gst_amount,
      lineItems: parsed.line_items,
    };
  }

  private todayIso() {
    return new Date().toISOString().slice(0, 10);
  }
}
