import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  SQL,
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { BudgetsService } from '../budgets/budgets.service';
import { CategoriesService } from '../categories/categories.service';
import { DrizzleService } from '../database/drizzle.service';
import { expenseTags, expenses, tags } from '../database/schema';
import { DashboardEventsService } from '../dashboard/dashboard-events.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { SearchExpensesDto } from './dto/search-expenses.dto';
import { UpdateExpenseTagsDto } from './dto/update-expense-tags.dto';
import { GroqService } from './groq.service';
import { ExpensePreview, ParsedReceiptDraft } from './types/expense.types';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly categoriesService: CategoriesService,
    private readonly budgetsService: BudgetsService,
    private readonly dashboardService: DashboardService,
    private readonly dashboardEventsService: DashboardEventsService,
    private readonly notificationsService: NotificationsService,
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

    const summary = await this.dashboardService.getSummary(userId);
    await this.dashboardEventsService.publish(userId, {
      type: 'summary',
      data: summary,
    });

    const alert = await this.budgetsService.getBudgetAlertForExpense(
      userId,
      expense.categoryId,
      new Date(expense.date),
    );

    if (alert) {
      await this.notificationsService.createNotification(
        userId,
        'budget_alert',
        `${alert.categoryName} crossed ${alert.threshold}% of its budget for ${alert.month}.`,
      );
      await this.dashboardEventsService.publish(userId, {
        type: 'budget_alert',
        data: alert,
      });
    }

    return { expense: { ...expense, tags: [] } };
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
    const rows = await this.drizzle.db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(desc(expenses.date), desc(expenses.createdAt))
      .limit(10);

    return this.withTags(userId, rows);
  }

  async search(userId: string, query: SearchExpensesDto) {
    const conditions: SQL[] = [eq(expenses.userId, userId)];

    if (query.q) {
      const escaped = query.q.replace(/[\\%_]/g, '\\$&');
      const pattern = `%${escaped}%`;
      conditions.push(or(ilike(expenses.merchant, pattern), ilike(expenses.note, pattern))!);
    }
    if (query.min_amount) {
      conditions.push(gte(expenses.amount, query.min_amount));
    }
    if (query.max_amount) {
      conditions.push(lte(expenses.amount, query.max_amount));
    }
    if (query.category_id) {
      conditions.push(inArray(expenses.categoryId, this.splitList(query.category_id)));
    }
    if (query.payment_method) {
      conditions.push(
        inArray(
          expenses.paymentMethod,
          this.splitList(query.payment_method) as Array<'upi' | 'card' | 'cash' | 'netbanking'>,
        ),
      );
    }
    if (query.date_from) {
      conditions.push(gte(expenses.date, new Date(`${query.date_from}T00:00:00.000Z`)));
    }
    if (query.date_to) {
      conditions.push(lte(expenses.date, new Date(`${query.date_to}T23:59:59.999Z`)));
    }
    if (query.tag_id) {
      const tagIds = this.splitList(query.tag_id);
      conditions.push(sql`exists (
        select 1 from ${expenseTags}
        inner join ${tags} on ${tags.id} = ${expenseTags.tagId}
        where ${expenseTags.expenseId} = ${expenses.id}
          and ${tags.userId} = ${userId}
          and ${inArray(expenseTags.tagId, tagIds)}
      )`);
    }

    const where = and(...conditions);
    const offset = (query.page - 1) * query.limit;
    const [rows, countRows, availableTags] = await Promise.all([
      this.drizzle.db
        .select()
        .from(expenses)
        .where(where)
        .orderBy(desc(expenses.date), desc(expenses.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.drizzle.db
        .select({ total: sql<number>`count(*)::int` })
        .from(expenses)
        .where(where),
      this.drizzle.db
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(eq(tags.userId, userId))
        .orderBy(asc(tags.name)),
    ]);
    const total = Number(countRows[0]?.total ?? 0);

    return {
      expenses: await this.withTags(userId, rows),
      availableTags,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async addTags(userId: string, expenseId: string, dto: UpdateExpenseTagsDto) {
    await this.assertExpenseOwner(userId, expenseId);

    await this.drizzle.db.transaction(async (tx) => {
      const requestedTagIds = [...new Set(dto.tagIds)];
      if (requestedTagIds.length) {
        const ownedTags = await tx
          .select({ id: tags.id })
          .from(tags)
          .where(and(eq(tags.userId, userId), inArray(tags.id, requestedTagIds)));
        if (ownedTags.length !== requestedTagIds.length) {
          throw new BadRequestException('One or more tags are invalid');
        }
      }

      const namesByNormalizedValue = new Map<string, string>();
      for (const name of dto.names) {
        const trimmed = name.trim().replace(/\s+/g, ' ');
        namesByNormalizedValue.set(trimmed.toLowerCase(), trimmed);
      }

      for (const [normalizedName, displayName] of namesByNormalizedValue) {
        let [tag] = await tx
          .select({ id: tags.id })
          .from(tags)
          .where(and(eq(tags.userId, userId), sql`lower(${tags.name}) = ${normalizedName}`));

        if (!tag) {
          [tag] = await tx
            .insert(tags)
            .values({ userId, name: displayName })
            .onConflictDoNothing()
            .returning({ id: tags.id });
        }

        if (!tag) {
          [tag] = await tx
            .select({ id: tags.id })
            .from(tags)
            .where(and(eq(tags.userId, userId), sql`lower(${tags.name}) = ${normalizedName}`));
        }

        if (tag) {
          requestedTagIds.push(tag.id);
        }
      }

      const uniqueTagIds = [...new Set(requestedTagIds)];
      if (uniqueTagIds.length) {
        await tx
          .insert(expenseTags)
          .values(uniqueTagIds.map((tagId) => ({ expenseId, tagId })))
          .onConflictDoNothing();
      }
    });

    const tagsByExpense = await this.getExpenseTags(userId, [expenseId]);
    return { expenseId, tags: tagsByExpense.get(expenseId) ?? [] };
  }

  async removeTag(userId: string, expenseId: string, tagId: string) {
    await this.assertExpenseOwner(userId, expenseId);
    await this.drizzle.db
      .delete(expenseTags)
      .where(and(eq(expenseTags.expenseId, expenseId), eq(expenseTags.tagId, tagId)));

    return { success: true };
  }

  private async assertExpenseOwner(userId: string, expenseId: string) {
    const [expense] = await this.drizzle.db
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
      .limit(1);
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
  }

  private async withTags<T extends { id: string }>(userId: string, rows: T[]) {
    const tagsByExpense = await this.getExpenseTags(
      userId,
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({ ...row, tags: tagsByExpense.get(row.id) ?? [] }));
  }

  private async getExpenseTags(userId: string, expenseIds: string[]) {
    const result = new Map<string, Array<{ id: string; name: string }>>();
    if (!expenseIds.length) {
      return result;
    }

    const rows = await this.drizzle.db
      .select({ expenseId: expenseTags.expenseId, id: tags.id, name: tags.name })
      .from(expenseTags)
      .innerJoin(tags, eq(tags.id, expenseTags.tagId))
      .where(and(eq(tags.userId, userId), inArray(expenseTags.expenseId, expenseIds)))
      .orderBy(asc(tags.name));

    for (const row of rows) {
      const current = result.get(row.expenseId) ?? [];
      current.push({ id: row.id, name: row.name });
      result.set(row.expenseId, current);
    }
    return result;
  }

  private splitList(value: string) {
    return value.split(',').map((item) => item.trim());
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
