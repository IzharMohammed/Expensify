import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { DashboardEventsService } from '../dashboard/dashboard-events.service';
import { DrizzleService } from '../database/drizzle.service';
import { notifications, recurringExpenses, users } from '../database/schema';

type NotificationType = 'budget_alert' | 'recurring_due' | 'no_spend_today' | 'anomaly_alert';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly dashboardEventsService: DashboardEventsService,
  ) {}

  async createNotification(
    userId: string,
    type: NotificationType,
    message: string,
    options?: { recurringExpenseId?: string | null },
  ) {
    const [notification] = await this.drizzle.db
      .insert(notifications)
      .values({
        userId,
        recurringExpenseId: options?.recurringExpenseId ?? null,
        type,
        message,
      })
      .returning();

    const serialized = this.serializeNotification(notification);
    await this.dashboardEventsService.publish(userId, {
      type: 'notification',
      data: serialized,
    });

    return serialized;
  }

  async list(userId: string) {
    const rows = await this.drizzle.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    const unreadResult = await this.drizzle.db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM notifications
      WHERE user_id = ${userId}
        AND is_read = false
    `);

    return {
      notifications: rows.map((row) => this.serializeNotification(row)),
      unreadCount: Number((unreadResult.rows[0] as { count?: number } | undefined)?.count ?? 0),
    };
  }

  async markRead(userId: string, notificationId: string) {
    const [notification] = await this.drizzle.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return { notification: this.serializeNotification(notification) };
  }

  async createNoSpendNudges() {
    const userRows = await this.drizzle.db.select({ id: users.id }).from(users);
    const todayStart = this.dayStart(0);
    const tomorrowStart = this.dayStart(1);

    for (const user of userRows) {
      const expenseResult = await this.drizzle.db.execute(sql`
        SELECT COUNT(*)::int AS count
        FROM expenses
        WHERE user_id = ${user.id}
          AND date >= ${todayStart}
          AND date < ${tomorrowStart}
      `);

      if (Number((expenseResult.rows[0] as { count?: number } | undefined)?.count ?? 0) > 0) {
        continue;
      }

      const [existing] = await this.drizzle.db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, user.id),
            eq(notifications.type, 'no_spend_today'),
            gte(notifications.createdAt, todayStart),
            lt(notifications.createdAt, tomorrowStart),
          ),
        )
        .limit(1);

      if (!existing) {
        await this.createNotification(user.id, 'no_spend_today', 'No expenses recorded today. Add today’s spend before the day ends.');
      }
    }
  }

  async createWeekendAnomalyAlerts() {
    const userRows = await this.drizzle.db.select({ id: users.id }).from(users);
    const currentWeekend = this.previousWeekendRange();

    for (const user of userRows) {
      const currentWeekendResult = await this.drizzle.db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::float8 AS total
        FROM expenses
        WHERE user_id = ${user.id}
          AND date >= ${currentWeekend.start}
          AND date < ${currentWeekend.end}
      `);
      const currentSpend = Number((currentWeekendResult.rows[0] as { total?: number } | undefined)?.total ?? 0);
      if (currentSpend <= 0) {
        continue;
      }

      const historicalResult = await this.drizzle.db.execute(sql`
        WITH weekends AS (
          SELECT
            DATE_TRUNC('week', date) + INTERVAL '5 days' AS weekend_start,
            COALESCE(SUM(amount::numeric), 0)::float8 AS total
          FROM expenses
          WHERE user_id = ${user.id}
            AND date >= ${currentWeekend.historyStart}
            AND date < ${currentWeekend.start}
            AND EXTRACT(DOW FROM date) IN (0, 6)
          GROUP BY DATE_TRUNC('week', date) + INTERVAL '5 days'
          ORDER BY weekend_start DESC
          LIMIT 8
        )
        SELECT COALESCE(AVG(total), 0)::float8 AS average
        FROM weekends
      `);

      const average = Number((historicalResult.rows[0] as { average?: number } | undefined)?.average ?? 0);
      if (average <= 0 || currentSpend <= average * 1.5) {
        continue;
      }

      const [existing] = await this.drizzle.db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, user.id),
            eq(notifications.type, 'anomaly_alert'),
            gte(notifications.createdAt, currentWeekend.start),
            lt(notifications.createdAt, currentWeekend.end),
          ),
        )
        .limit(1);

      if (!existing) {
        const increase = ((currentSpend - average) / average) * 100;
        await this.createNotification(
          user.id,
          'anomaly_alert',
          `Weekend spending was ${increase.toFixed(0)}% above your usual weekend average.`,
        );
      }
    }
  }

  private serializeNotification(row: typeof notifications.$inferSelect) {
    return {
      id: row.id,
      userId: row.userId,
      recurringExpenseId: row.recurringExpenseId,
      type: row.type,
      message: row.message,
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private dayStart(offsetDays: number) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
  }

  private previousWeekendRange() {
    const now = new Date();
    const day = now.getUTCDay();
    const currentWeekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
    const end = new Date(currentWeekStart);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 1);
    const historyStart = new Date(start);
    historyStart.setUTCDate(historyStart.getUTCDate() - 56);
    return { start, end, historyStart };
  }
}
