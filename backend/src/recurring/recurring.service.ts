import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  notifications,
  recurringExpenses,
  users,
  type RecurringExpense,
} from '../database/schema';

type Frequency = 'monthly' | 'weekly' | 'yearly';

type ExpenseRow = {
  merchant: string;
  amount: number;
  categoryId: string | null;
  date: Date;
};

@Injectable()
export class RecurringService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(userId: string) {
    const [confirmed, pending, reminderRows] = await Promise.all([
      this.drizzle.db
        .select()
        .from(recurringExpenses)
        .where(and(eq(recurringExpenses.userId, userId), eq(recurringExpenses.isConfirmed, true)))
        .orderBy(recurringExpenses.nextDueDate, desc(recurringExpenses.createdAt)),
      this.drizzle.db
        .select()
        .from(recurringExpenses)
        .where(and(eq(recurringExpenses.userId, userId), eq(recurringExpenses.isConfirmed, false)))
        .orderBy(desc(recurringExpenses.createdAt)),
      this.drizzle.db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.type, 'recurring_due')))
        .orderBy(desc(notifications.createdAt))
        .limit(10),
    ]);

    return {
      recurringExpenses: confirmed.map((item) => this.serializeRecurring(item)),
      pendingDetections: pending.map((item) => this.serializeRecurring(item)),
      monthlyTotal: confirmed.reduce((sum, item) => sum + this.monthlyEquivalent(item), 0),
      reminders: reminderRows.map((row) => ({
        id: row.id,
        message: row.message,
        createdAt: row.createdAt.toISOString(),
        isRead: row.isRead,
        recurringExpenseId: row.recurringExpenseId,
      })),
    };
  }

  async confirm(userId: string, recurringId: string) {
    const recurring = await this.requireRecurring(userId, recurringId);
    const [updated] = await this.drizzle.db
      .update(recurringExpenses)
      .set({ isConfirmed: true })
      .where(eq(recurringExpenses.id, recurring.id))
      .returning();

    return { recurringExpense: this.serializeRecurring(updated) };
  }

  async reject(userId: string, recurringId: string) {
    await this.requireRecurring(userId, recurringId);
    await this.drizzle.db.delete(recurringExpenses).where(eq(recurringExpenses.id, recurringId));
    return { success: true };
  }

  async detectForAllUsers() {
    const userRows = await this.drizzle.db.select({ id: users.id }).from(users);
    for (const user of userRows) {
      await this.detectForUser(user.id);
    }
  }

  async createDueNotificationsForAllUsers() {
    const userRows = await this.drizzle.db.select({ id: users.id }).from(users);
    for (const user of userRows) {
      await this.createDueNotificationsForUser(user.id);
    }
  }

  private async detectForUser(userId: string) {
    const expenseRows = await this.drizzle.db.execute(sql`
      SELECT merchant, amount::float8 AS amount, category_id AS "categoryId", date
      FROM expenses
      WHERE user_id = ${userId}
        AND date >= NOW() - INTERVAL '425 days'
      ORDER BY date ASC
    `);

    const expenses = expenseRows.rows.map((row) => ({
      merchant: String(row.merchant),
      amount: Number(row.amount ?? 0),
      categoryId: row.categoryId ? String(row.categoryId) : null,
      date: new Date(String(row.date)),
    })) as ExpenseRow[];

    if (expenses.length === 0) {
      return;
    }

    const existing = await this.drizzle.db
      .select()
      .from(recurringExpenses)
      .where(eq(recurringExpenses.userId, userId));

    const existingMap = new Map(
      existing.map((item) => [this.recurringKey(item.merchant, item.frequency), item]),
    );

    const grouped = new Map<string, ExpenseRow[]>();
    for (const expense of expenses) {
      const key = this.normalizeMerchant(expense.merchant);
      if (!key) {
        continue;
      }
      const current = grouped.get(key);
      if (current) {
        current.push(expense);
      } else {
        grouped.set(key, [expense]);
      }
    }

    for (const entries of grouped.values()) {
      const detection = this.detectPattern(entries);
      if (!detection) {
        continue;
      }

      const key = this.recurringKey(detection.merchant, detection.frequency);
      const existingRow = existingMap.get(key);
      if (existingRow) {
        if (existingRow.nextDueDate < detection.nextDueDate) {
          await this.drizzle.db
            .update(recurringExpenses)
            .set({
              amount: detection.amount.toFixed(2),
              categoryId: detection.categoryId,
              nextDueDate: detection.nextDueDate,
              isAutoDetected: true,
            })
            .where(eq(recurringExpenses.id, existingRow.id));
        }
        continue;
      }

      const [created] = await this.drizzle.db
        .insert(recurringExpenses)
        .values({
          userId,
          merchant: detection.merchant,
          amount: detection.amount.toFixed(2),
          categoryId: detection.categoryId,
          frequency: detection.frequency,
          nextDueDate: detection.nextDueDate,
          isAutoDetected: true,
          isConfirmed: false,
        })
        .returning();

      existingMap.set(key, created);
    }
  }

  private async createDueNotificationsForUser(userId: string) {
    const tomorrowStart = this.startOfDayOffset(1);
    const dayAfterTomorrow = this.startOfDayOffset(2);
    const todayStart = this.startOfDayOffset(0);
    const tomorrowDue = await this.drizzle.db
      .select()
      .from(recurringExpenses)
      .where(
        and(
          eq(recurringExpenses.userId, userId),
          eq(recurringExpenses.isConfirmed, true),
          gte(recurringExpenses.nextDueDate, tomorrowStart),
          lt(recurringExpenses.nextDueDate, dayAfterTomorrow),
        ),
      );

    for (const recurring of tomorrowDue) {
      const [existingNotice] = await this.drizzle.db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.recurringExpenseId, recurring.id),
            eq(notifications.type, 'recurring_due'),
            gte(notifications.createdAt, todayStart),
            lt(notifications.createdAt, tomorrowStart),
          ),
        )
        .limit(1);

      if (existingNotice) {
        continue;
      }

      await this.notificationsService.createNotification(
        userId,
        'recurring_due',
        `${recurring.merchant} renews tomorrow`,
        { recurringExpenseId: recurring.id },
      );
    }
  }

  private detectPattern(entries: ExpenseRow[]) {
    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const configs: Array<{
      frequency: Frequency;
      minOccurrences: number;
      minGap: number;
      maxGap: number;
      stepDays: number;
    }> = [
      { frequency: 'monthly', minOccurrences: 3, minGap: 28, maxGap: 32, stepDays: 30 },
      { frequency: 'weekly', minOccurrences: 3, minGap: 6, maxGap: 8, stepDays: 7 },
      { frequency: 'yearly', minOccurrences: 2, minGap: 360, maxGap: 370, stepDays: 365 },
    ];

    for (const config of configs) {
      const sample = sorted.slice(-config.minOccurrences);
      if (sample.length < config.minOccurrences) {
        continue;
      }

      const amounts = sample.map((item) => item.amount);
      const median = this.median(amounts);
      const amountsStable = amounts.every((amount) => Math.abs(amount - median) / median <= 0.1);
      if (!amountsStable) {
        continue;
      }

      const intervals = sample.slice(1).map((item, index) => this.diffDays(sample[index].date, item.date));
      const regular = intervals.every(
        (days) => days >= config.minGap && days <= config.maxGap,
      );
      if (!regular) {
        continue;
      }

      const latest = sample[sample.length - 1];
      return {
        merchant: latest.merchant,
        amount: this.average(amounts),
        categoryId: this.mostCommonCategory(sample),
        frequency: config.frequency,
        nextDueDate: this.addDays(latest.date, config.stepDays),
      };
    }

    return null;
  }

  private monthlyEquivalent(item: RecurringExpense) {
    const amount = Number(item.amount);
    switch (item.frequency) {
      case 'weekly':
        return (amount * 52) / 12;
      case 'yearly':
        return amount / 12;
      default:
        return amount;
    }
  }

  private serializeRecurring(item: RecurringExpense) {
    const amount = Number(item.amount);
    return {
      id: item.id,
      userId: item.userId,
      merchant: item.merchant,
      amount,
      categoryId: item.categoryId,
      frequency: item.frequency,
      nextDueDate: item.nextDueDate.toISOString(),
      isAutoDetected: item.isAutoDetected,
      isConfirmed: item.isConfirmed,
      createdAt: item.createdAt.toISOString(),
      monthlyEquivalent: this.monthlyEquivalent(item),
    };
  }

  private async requireRecurring(userId: string, recurringId: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(recurringExpenses)
      .where(and(eq(recurringExpenses.id, recurringId), eq(recurringExpenses.userId, userId)));

    if (!row) {
      throw new NotFoundException('Recurring expense not found');
    }

    return row;
  }

  private normalizeMerchant(value: string) {
    return value
      .toLowerCase()
      .replace(/\d+/g, ' ')
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\b(upi|card|debit|credit|payment|txn|purchase|india|ltd|private|pvt)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private recurringKey(merchant: string, frequency: Frequency) {
    return `${this.normalizeMerchant(merchant)}::${frequency}`;
  }

  private diffDays(from: Date, to: Date) {
    return Math.round((to.getTime() - from.getTime()) / 86_400_000);
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private startOfDayOffset(offsetDays: number) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
  }

  private median(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  }

  private average(values: number[]) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private mostCommonCategory(entries: ExpenseRow[]) {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      if (!entry.categoryId) {
        continue;
      }
      counts.set(entry.categoryId, (counts.get(entry.categoryId) ?? 0) + 1);
    }

    let winner: string | null = null;
    let max = 0;
    for (const [categoryId, count] of counts.entries()) {
      if (count > max) {
        max = count;
        winner = categoryId;
      }
    }

    return winner;
  }
}
