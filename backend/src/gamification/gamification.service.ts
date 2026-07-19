import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { DashboardEventsService } from '../dashboard/dashboard-events.service';
import { DrizzleService } from '../database/drizzle.service';
import { badges, streaks, userBadges, users } from '../database/schema';

type EvaluationContext = {
  expenseCount: number;
  currentStreak: number;
  monthlyIncome: number;
  monthlySpend: number;
  sevenDayExpenseCount: number;
  sevenDaySwiggyCount: number;
  hasSevenDayHistory: boolean;
};

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);
  private readonly timeZone: string;

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly dashboardEvents: DashboardEventsService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE') ?? 'Asia/Kolkata';
  }

  async evaluateAllUsers(now = new Date()) {
    const targetDate = this.previousCalendarDate(now);
    const userRows = await this.drizzle.db.select({ id: users.id }).from(users);
    const failures: string[] = [];
    for (const user of userRows) {
      try {
        await this.evaluateUser(user.id, targetDate);
      } catch (error) {
        failures.push(user.id);
        this.logger.error(
          `Gamification evaluation failed for user ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (failures.length) throw new Error(`Gamification failed for ${failures.length} user(s)`);
  }

  async getStreak(userId: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(streaks)
      .where(eq(streaks.userId, userId))
      .limit(1);

    return {
      currentStreak: row?.currentStreak ?? 0,
      longestStreak: row?.longestStreak ?? 0,
      lastQualifyingDate: row?.lastQualifyingDate?.toISOString().slice(0, 10) ?? null,
      rule: 'With a monthly budget, a day qualifies when total spend stays within the prorated daily allowance. Without a budget, logging at least one expense qualifies.',
      timeZone: this.timeZone,
    };
  }

  async getBadges(userId: string) {
    const rows = await this.drizzle.db
      .select({
        id: badges.id,
        code: badges.code,
        name: badges.name,
        description: badges.description,
        icon: badges.icon,
        earnedAt: userBadges.earnedAt,
      })
      .from(badges)
      .leftJoin(
        userBadges,
        and(eq(userBadges.badgeId, badges.id), eq(userBadges.userId, userId)),
      )
      .orderBy(asc(badges.name));

    const serialized = rows.map((badge) => ({
      ...badge,
      earned: badge.earnedAt !== null,
      earnedAt: badge.earnedAt?.toISOString() ?? null,
    }));
    return {
      badges: serialized,
      earnedCount: serialized.filter((badge) => badge.earned).length,
      total: serialized.length,
    };
  }

  private async evaluateUser(userId: string, targetDate: Date) {
    const targetDateText = this.isoDate(targetDate);
    const monthStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 1));
    const daysInMonth = new Date(
      Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0),
    ).getUTCDate();

    const dailyResult = await this.drizzle.db.execute(sql`
      SELECT COUNT(*)::int AS count, COALESCE(SUM(amount::numeric), 0)::float8 AS spend
      FROM expenses
      WHERE user_id = ${userId}
        AND (date AT TIME ZONE ${this.timeZone})::date = ${targetDateText}::date
    `);
    const budgetResult = await this.drizzle.db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0)::float8 AS total
      FROM budgets
      WHERE user_id = ${userId} AND month = ${monthStart}
    `);
    const expenseCount = Number(dailyResult.rows[0]?.count ?? 0);
    const dailySpend = Number(dailyResult.rows[0]?.spend ?? 0);
    const monthlyBudget = Number(budgetResult.rows[0]?.total ?? 0);
    const dailyAllowance = monthlyBudget / daysInMonth;
    const qualifies = monthlyBudget > 0 ? dailySpend <= dailyAllowance : expenseCount > 0;
    const streak = await this.updateStreak(userId, targetDate, qualifies);
    const badgeContext = await this.buildBadgeContext(
      userId,
      targetDate,
      monthStart,
      nextMonthStart,
      expenseCount,
      streak.currentStreak,
    );
    await this.evaluateBadges(userId, badgeContext);
  }

  private async updateStreak(userId: string, targetDate: Date, qualifies: boolean) {
    if (!qualifies) {
      const result = await this.drizzle.db.execute(sql`
        INSERT INTO streaks (user_id, current_streak, longest_streak, last_qualifying_date)
        VALUES (${userId}, 0, 0, NULL)
        ON CONFLICT (user_id) DO UPDATE SET current_streak = 0
        RETURNING current_streak AS "currentStreak", longest_streak AS "longestStreak"
      `);
      return {
        currentStreak: Number(result.rows[0]?.currentStreak ?? 0),
        longestStreak: Number(result.rows[0]?.longestStreak ?? 0),
      };
    }

    const previousDate = this.addDays(targetDate, -1);
    const result = await this.drizzle.db.execute(sql`
      INSERT INTO streaks (user_id, current_streak, longest_streak, last_qualifying_date)
      VALUES (${userId}, 1, 1, ${targetDate})
      ON CONFLICT (user_id) DO UPDATE SET
        current_streak = CASE
          WHEN streaks.last_qualifying_date = ${targetDate}::date THEN streaks.current_streak
          WHEN streaks.last_qualifying_date = ${previousDate}::date THEN streaks.current_streak + 1
          ELSE 1
        END,
        longest_streak = GREATEST(
          streaks.longest_streak,
          CASE
            WHEN streaks.last_qualifying_date = ${targetDate}::date THEN streaks.current_streak
            WHEN streaks.last_qualifying_date = ${previousDate}::date THEN streaks.current_streak + 1
            ELSE 1
          END
        ),
        last_qualifying_date = ${targetDate}
      RETURNING current_streak AS "currentStreak", longest_streak AS "longestStreak"
    `);
    return {
      currentStreak: Number(result.rows[0]?.currentStreak ?? 0),
      longestStreak: Number(result.rows[0]?.longestStreak ?? 0),
    };
  }

  private async buildBadgeContext(
    userId: string,
    targetDate: Date,
    monthStart: Date,
    nextMonthStart: Date,
    expenseCount: number,
    currentStreak: number,
  ): Promise<EvaluationContext> {
    const sevenDayStart = this.addDays(targetDate, -6);
    const sevenDayStartText = this.isoDate(sevenDayStart);
    const targetDateText = this.isoDate(targetDate);
    const result = await this.drizzle.db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM expenses WHERE user_id = ${userId}) AS "allExpenseCount",
        (SELECT COALESCE(SUM(amount::numeric), 0)::float8 FROM monthly_income
          WHERE user_id = ${userId} AND month = ${monthStart}) AS "monthlyIncome",
        (SELECT COALESCE(SUM(amount::numeric), 0)::float8 FROM expenses
          WHERE user_id = ${userId} AND date >= ${monthStart} AND date < ${nextMonthStart}) AS "monthlySpend",
        (SELECT COUNT(*)::int FROM expenses
          WHERE user_id = ${userId}
            AND (date AT TIME ZONE ${this.timeZone})::date BETWEEN ${sevenDayStartText}::date AND ${targetDateText}::date) AS "sevenDayExpenseCount",
        (SELECT COUNT(*)::int FROM expenses
          WHERE user_id = ${userId}
            AND merchant ILIKE '%swiggy%'
            AND (date AT TIME ZONE ${this.timeZone})::date BETWEEN ${sevenDayStartText}::date AND ${targetDateText}::date) AS "sevenDaySwiggyCount",
        COALESCE((SELECT MIN((date AT TIME ZONE ${this.timeZone})::date) <= ${sevenDayStartText}::date
          FROM expenses WHERE user_id = ${userId}), false) AS "hasSevenDayHistory"
    `);
    const row = result.rows[0];
    return {
      expenseCount: Number(row?.allExpenseCount ?? expenseCount),
      currentStreak,
      monthlyIncome: Number(row?.monthlyIncome ?? 0),
      monthlySpend: Number(row?.monthlySpend ?? 0),
      sevenDayExpenseCount: Number(row?.sevenDayExpenseCount ?? 0),
      sevenDaySwiggyCount: Number(row?.sevenDaySwiggyCount ?? 0),
      hasSevenDayHistory: Boolean(row?.hasSevenDayHistory),
    };
  }

  private async evaluateBadges(userId: string, context: EvaluationContext) {
    const rules: Array<{ code: string; check: (value: EvaluationContext) => boolean }> = [
      { code: 'first_expense', check: this.checkFirstExpense },
      { code: 'no_swiggy_week', check: this.checkNoSwiggyWeek },
      { code: 'saved_10k', check: this.checkSaved10k },
      { code: 'streak_7', check: this.check7DayStreak },
      { code: 'streak_30', check: this.check30DayStreak },
    ];
    const earnedCodes = rules.filter((rule) => rule.check(context)).map((rule) => rule.code);
    if (!earnedCodes.length) return;

    const badgeRows = await this.drizzle.db
      .select()
      .from(badges)
      .where(inArray(badges.code, earnedCodes));
    for (const badge of badgeRows) {
      const [award] = await this.drizzle.db
        .insert(userBadges)
        .values({ userId, badgeId: badge.id })
        .onConflictDoNothing()
        .returning({ earnedAt: userBadges.earnedAt });
      if (!award) continue;

      await this.dashboardEvents.publish(userId, {
        type: 'badge_earned',
        data: {
          id: badge.id,
          code: badge.code,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          earnedAt: award.earnedAt.toISOString(),
        },
      });
    }
  }

  private readonly checkFirstExpense = (context: EvaluationContext) => context.expenseCount >= 1;
  private readonly checkNoSwiggyWeek = (context: EvaluationContext) =>
    context.hasSevenDayHistory &&
    context.sevenDayExpenseCount >= 1 &&
    context.sevenDaySwiggyCount === 0;
  private readonly checkSaved10k = (context: EvaluationContext) =>
    context.monthlyIncome > 0 && context.monthlyIncome - context.monthlySpend >= 10_000;
  private readonly check7DayStreak = (context: EvaluationContext) => context.currentStreak >= 7;
  private readonly check30DayStreak = (context: EvaluationContext) => context.currentStreak >= 30;

  private previousCalendarDate(now: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) - 1));
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private isoDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}
