import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, lt, sql } from 'drizzle-orm';
import { BudgetsService } from '../budgets/budgets.service';
import { DrizzleService } from '../database/drizzle.service';
import { Insight, insights, monthlyIncome } from '../database/schema';
import { UsersService } from '../users/users.service';
import { InsightsAiService } from './insights-ai.service';
import { AggregatedInsightInput, GeneratedAiInsight } from './types/insight.types';

@Injectable()
export class InsightsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly usersService: UsersService,
    private readonly budgetsService: BudgetsService,
    private readonly insightsAiService: InsightsAiService,
  ) {}

  async generateForAllUsers(targetDate = new Date()) {
    const users = await this.usersService.listAll();
    for (const user of users) {
      await this.generateForUser(user.id, targetDate);
    }
  }

  async generateForUser(userId: string, targetDate = new Date()) {
    const currentMonthStart = this.monthStart(targetDate);
    const previousMonthStart = this.monthOffset(currentMonthStart, -1);
    const nextMonthStart = this.monthOffset(currentMonthStart, 1);
    const daysElapsed = Math.max(1, targetDate.getUTCDate());
    const daysInMonth = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0)).getUTCDate();

    const categoryTotals = await this.fetchCategoryComparisons(userId, currentMonthStart, previousMonthStart, nextMonthStart);
    const dominantDays = await this.fetchDayPatterns(userId, currentMonthStart, nextMonthStart);
    const summary = await this.fetchSummary(userId, currentMonthStart, nextMonthStart);
    const previousInsightTexts = await this.fetchPreviousInsightTexts(userId, targetDate);
    const budgetSnapshot = await this.budgetsService.listMonth(userId, currentMonthStart.toISOString().slice(0, 7));

    const projectedOverallSpend =
      daysElapsed > 0 ? (summary.currentMonthSpend / daysElapsed) * daysInMonth : summary.currentMonthSpend;
    const projectedSavings = summary.remainingIncome - (projectedOverallSpend - summary.currentMonthSpend);

    const budgetRisks = budgetSnapshot.budgets
      .filter((budget) => budget.budgetAmount && budget.budgetAmount > 0)
      .map((budget) => {
        const projectedSpend = daysElapsed > 0 ? (budget.spent / daysElapsed) * daysInMonth : budget.spent;
        return {
          category: budget.categoryName,
          budget: budget.budgetAmount!,
          projectedSpend,
          overshoot: projectedSpend - budget.budgetAmount!,
        };
      })
      .filter((risk) => risk.overshoot > 0);

    const aggregatedInput: AggregatedInsightInput = {
      analyzedDate: targetDate.toISOString().slice(0, 10),
      analyzedMonth: currentMonthStart.toISOString().slice(0, 10),
      categoryTotals: categoryTotals.map((item) => ({
        category: item.category,
        current: item.current,
        previous: item.previous,
        percentageChange:
          item.previous > 0 ? ((item.current - item.previous) / item.previous) * 100 : null,
        budget: item.budget,
        spentRatio: item.budget && item.budget > 0 ? (item.current / item.budget) * 100 : null,
      })),
      dominantDays,
      remainingIncome: summary.remainingIncome,
      spendingVelocity: daysElapsed > 0 ? summary.currentMonthSpend / daysElapsed : 0,
      projectedOverallSpend,
      projectedSavings,
      budgetRisks,
      previousInsightTexts,
    };

    const aiInsights = await this.insightsAiService.generateInsights(aggregatedInput);
    const predictionInsights = this.buildPredictionInsights({
      analyzedDate: targetDate,
      analyzedMonthStart: currentMonthStart,
      daysElapsed,
      daysInMonth,
      categoryTotals,
      remainingIncome: summary.remainingIncome,
      currentMonthSpend: summary.currentMonthSpend,
      budgetRisks,
    });

    await this.persistInsights(userId, targetDate, currentMonthStart, aiInsights, predictionInsights);
  }

  async getToday(userId: string, date?: string) {
    const target = date === 'today' || !date ? new Date().toISOString().slice(0, 10) : date;
    return this.drizzle.db
      .select()
      .from(insights)
      .where(and(eq(insights.userId, userId), eq(insights.date, this.dateOnly(new Date(target)))))
      .orderBy(desc(insights.createdAt));
  }

  async getByMonth(userId: string, month: string) {
    const monthStart = this.monthStartFromString(month);
    return this.drizzle.db
      .select()
      .from(insights)
      .where(and(eq(insights.userId, userId), eq(insights.month, monthStart)))
      .orderBy(desc(insights.date), desc(insights.createdAt));
  }

  async getLatest(userId: string) {
    const [latest] = await this.drizzle.db
      .select({ date: insights.date })
      .from(insights)
      .where(eq(insights.userId, userId))
      .orderBy(desc(insights.date), desc(insights.createdAt))
      .limit(1);

    if (!latest) {
      return [];
    }

    return this.drizzle.db
      .select()
      .from(insights)
      .where(and(eq(insights.userId, userId), eq(insights.date, latest.date)))
      .orderBy(desc(insights.priority), asc(insights.createdAt));
  }

  async getHistory(userId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const items = await this.drizzle.db
      .select()
      .from(insights)
      .where(eq(insights.userId, userId))
      .orderBy(desc(insights.date), desc(insights.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(insights)
      .where(eq(insights.userId, userId));

    return {
      items,
      page,
      limit,
      total: Number(count ?? 0),
    };
  }

  private async fetchCategoryComparisons(
    userId: string,
    currentMonthStart: Date,
    previousMonthStart: Date,
    nextMonthStart: Date,
  ) {
    const result = await this.drizzle.db.execute(sql`
      WITH current_month AS (
        SELECT c.name AS category, COALESCE(SUM(e.amount::numeric), 0)::float8 AS total
        FROM categories c
        LEFT JOIN expenses e
          ON e.category_id = c.id
         AND e.user_id = ${userId}
         AND e.date >= ${currentMonthStart}
         AND e.date < ${nextMonthStart}
        WHERE c.user_id IS NULL OR c.user_id = ${userId}
        GROUP BY c.name
      ),
      previous_month AS (
        SELECT c.name AS category, COALESCE(SUM(e.amount::numeric), 0)::float8 AS total
        FROM categories c
        LEFT JOIN expenses e
          ON e.category_id = c.id
         AND e.user_id = ${userId}
         AND e.date >= ${previousMonthStart}
         AND e.date < ${currentMonthStart}
        WHERE c.user_id IS NULL OR c.user_id = ${userId}
        GROUP BY c.name
      ),
      current_budgets AS (
        SELECT c.name AS category, b.amount::float8 AS budget
        FROM budgets b
        INNER JOIN categories c ON c.id = b.category_id
        WHERE b.user_id = ${userId}
          AND b.month = ${currentMonthStart}
      )
      SELECT
        cm.category,
        cm.total AS current,
        COALESCE(pm.total, 0)::float8 AS previous,
        cb.budget AS budget
      FROM current_month cm
      LEFT JOIN previous_month pm ON pm.category = cm.category
      LEFT JOIN current_budgets cb ON cb.category = cm.category
      ORDER BY cm.total DESC, cm.category ASC
    `);

    return result.rows.map((row) => ({
      category: String(row.category),
      current: Number(row.current ?? 0),
      previous: Number(row.previous ?? 0),
      budget: row.budget === null ? null : Number(row.budget),
    }));
  }

  private async fetchDayPatterns(userId: string, currentMonthStart: Date, nextMonthStart: Date) {
    const result = await this.drizzle.db.execute(sql`
      SELECT EXTRACT(DOW FROM e.date)::int AS dow, COALESCE(SUM(e.amount::numeric), 0)::float8 AS spend
      FROM expenses e
      WHERE e.user_id = ${userId}
        AND e.date >= ${currentMonthStart}
        AND e.date < ${nextMonthStart}
      GROUP BY EXTRACT(DOW FROM e.date)
      ORDER BY spend DESC
    `);

    return result.rows.map((row) => ({
      dow: Number(row.dow),
      spend: Number(row.spend ?? 0),
    }));
  }

  private async fetchSummary(userId: string, currentMonthStart: Date, nextMonthStart: Date) {
    const spendResult = await this.drizzle.db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0)::float8 AS "currentMonthSpend"
      FROM expenses
      WHERE user_id = ${userId}
        AND date >= ${currentMonthStart}
        AND date < ${nextMonthStart}
    `);

    const [incomeRow] = await this.drizzle.db
      .select({
        income: sql<number>`COALESCE(SUM(${monthlyIncome.amount}::numeric), 0)::float8`,
      })
      .from(monthlyIncome)
      .where(and(eq(monthlyIncome.userId, userId), eq(monthlyIncome.month, currentMonthStart)));

    const currentMonthSpend = Number(
      (spendResult.rows[0] as { currentMonthSpend?: number } | undefined)?.currentMonthSpend ?? 0,
    );
    const income = Number(incomeRow?.income ?? 0);

    return {
      currentMonthSpend,
      remainingIncome: income - currentMonthSpend,
    };
  }

  private async fetchPreviousInsightTexts(userId: string, targetDate: Date) {
    const previousDate = new Date(targetDate);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);

    const rows = await this.drizzle.db
      .select({ insightText: insights.insightText })
      .from(insights)
      .where(and(eq(insights.userId, userId), eq(insights.date, previousDate)))
      .orderBy(asc(insights.createdAt));

    return rows.map((row) => row.insightText);
  }

  private buildPredictionInsights(params: {
    analyzedDate: Date;
    analyzedMonthStart: Date;
    daysElapsed: number;
    daysInMonth: number;
    categoryTotals: Array<{ category: string; current: number; previous: number; budget: number | null }>;
    remainingIncome: number;
    currentMonthSpend: number;
    budgetRisks: Array<{ category: string; budget: number; projectedSpend: number; overshoot: number }>;
  }): GeneratedAiInsight[] {
    const projectedSpend =
      params.daysElapsed > 0
        ? (params.currentMonthSpend / params.daysElapsed) * params.daysInMonth
        : params.currentMonthSpend;
    const projectedSavings = params.remainingIncome - (projectedSpend - params.currentMonthSpend);

    const insightsList: GeneratedAiInsight[] = [
      {
        insight_text: `Projected month-end spend is approximately Rs. ${projectedSpend.toFixed(0)}. Expected savings are around Rs. ${projectedSavings.toFixed(0)} if this pace continues.`,
        category: null,
        type: 'prediction',
        priority: projectedSavings < 0 ? 'high' : 'medium',
      },
    ];

    for (const risk of params.budgetRisks.slice(0, 2)) {
      insightsList.push({
        insight_text: `${risk.category} is likely to exceed its budget by about Rs. ${risk.overshoot.toFixed(0)} this month at the current pace.`,
        category: risk.category,
        type: 'prediction',
        priority: risk.overshoot > risk.budget * 0.1 ? 'high' : 'medium',
      });
    }

    const topCategory = [...params.categoryTotals].sort((a, b) => b.current - a.current)[0];
    if (topCategory && params.daysElapsed > 0) {
      const projectedCategorySpend = (topCategory.current / params.daysElapsed) * params.daysInMonth;
      insightsList.push({
        insight_text: `${topCategory.category} is projected to finish near Rs. ${projectedCategorySpend.toFixed(0)} this month.`,
        category: topCategory.category,
        type: 'prediction',
        priority: 'low',
      });
    }

    return insightsList;
  }

  private async persistInsights(
    userId: string,
    targetDate: Date,
    monthStart: Date,
    aiInsights: GeneratedAiInsight[],
    predictionInsights: GeneratedAiInsight[],
  ) {
    const records = [...aiInsights, ...predictionInsights].map((insight) => ({
      userId,
      date: this.dateOnly(targetDate),
      month: this.dateOnly(monthStart),
      insightText: insight.insight_text,
      category: insight.category,
      type: insight.type,
      priority: insight.priority,
    }));

    if (records.length === 0) {
      return;
    }

    await this.drizzle.db.insert(insights).values(records);
  }

  private monthStart(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private monthOffset(date: Date, offset: number) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  }

  private monthStartFromString(month: string) {
    const [year, monthValue] = month.split('-').map(Number);
    return new Date(Date.UTC(year, monthValue - 1, 1));
  }

  private dateOnly(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
}
