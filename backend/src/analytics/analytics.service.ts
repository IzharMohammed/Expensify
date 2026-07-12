import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';

type SpendingRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

@Injectable()
export class AnalyticsService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getSpending(userId: string, range: SpendingRange) {
    const config = this.rangeConfig(range);
    const startExpr = sql.raw(
      `date_trunc('${config.seriesUnit}', NOW()) - interval '${config.lookbackInterval}'`,
    );
    const endExpr = sql.raw(`date_trunc('${config.seriesUnit}', NOW())`);
    const stepExpr = sql.raw(`interval '${config.stepInterval}'`);

    const result = await this.drizzle.db.execute(sql`
      WITH series AS (
        SELECT generate_series(
          ${startExpr},
          ${endExpr},
          ${stepExpr}
        ) AS bucket
      )
      SELECT
        series.bucket AS bucket,
        COALESCE(SUM(e.amount::numeric), 0)::float8 AS total
      FROM series
      LEFT JOIN expenses e
        ON e.user_id = ${userId}
       AND e.date >= series.bucket
       AND e.date < series.bucket + ${stepExpr}
      GROUP BY series.bucket
      ORDER BY series.bucket ASC
    `);

    return {
      range,
      points: result.rows.map((row) => ({
        bucket: new Date(String(row.bucket)).toISOString(),
        total: Number(row.total ?? 0),
        label: this.formatBucketLabel(new Date(String(row.bucket)), range),
      })),
    };
  }

  async getCategoryDistribution(userId: string, month: string) {
    const monthStart = this.monthStart(month);
    const nextMonth = this.nextMonth(monthStart);

    const result = await this.drizzle.db.execute(sql`
      SELECT
        COALESCE(c.name, 'Uncategorized') AS category,
        COALESCE(SUM(e.amount::numeric), 0)::float8 AS total
      FROM expenses e
      LEFT JOIN categories c ON c.id = e.category_id
      WHERE e.user_id = ${userId}
        AND e.date >= ${monthStart}
        AND e.date < ${nextMonth}
      GROUP BY COALESCE(c.name, 'Uncategorized')
      HAVING COALESCE(SUM(e.amount::numeric), 0) > 0
      ORDER BY total DESC, category ASC
    `);

    return {
      month,
      items: result.rows.map((row) => ({
        category: String(row.category),
        total: Number(row.total ?? 0),
      })),
    };
  }

  async getHeatmap(userId: string, year: number) {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));

    const result = await this.drizzle.db.execute(sql`
      WITH days AS (
        SELECT generate_series(${start}, ${new Date(end.getTime() - 86_400_000)}, interval '1 day') AS day
      )
      SELECT
        days.day AS day,
        COALESCE(SUM(e.amount::numeric), 0)::float8 AS total
      FROM days
      LEFT JOIN expenses e
        ON e.user_id = ${userId}
       AND e.date >= days.day
       AND e.date < days.day + interval '1 day'
      GROUP BY days.day
      ORDER BY days.day ASC
    `);

    return {
      year,
      days: result.rows.map((row) => ({
        date: new Date(String(row.day)).toISOString().slice(0, 10),
        total: Number(row.total ?? 0),
      })),
    };
  }

  async getSavingsTrend(userId: string) {
    const start = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const end = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 1));

    const result = await this.drizzle.db.execute(sql`
      WITH months AS (
        SELECT generate_series(${start}, ${new Date(end.getTime() - 86_400_000)}, interval '1 month') AS month
      ),
      income AS (
        SELECT month, COALESCE(SUM(amount::numeric), 0)::float8 AS income
        FROM monthly_income
        WHERE user_id = ${userId}
          AND month >= ${start}
          AND month < ${end}
        GROUP BY month
      ),
      spend AS (
        SELECT date_trunc('month', date) AS month, COALESCE(SUM(amount::numeric), 0)::float8 AS spend
        FROM expenses
        WHERE user_id = ${userId}
          AND date >= ${start}
          AND date < ${end}
        GROUP BY date_trunc('month', date)
      )
      SELECT
        months.month AS month,
        COALESCE(income.income, 0)::float8 AS income,
        COALESCE(spend.spend, 0)::float8 AS spend,
        (COALESCE(income.income, 0) - COALESCE(spend.spend, 0))::float8 AS savings
      FROM months
      LEFT JOIN income ON income.month = months.month
      LEFT JOIN spend ON spend.month = months.month
      ORDER BY months.month ASC
    `);

    return {
      points: result.rows.map((row) => ({
        month: new Date(String(row.month)).toISOString().slice(0, 7),
        income: Number(row.income ?? 0),
        spend: Number(row.spend ?? 0),
        savings: Number(row.savings ?? 0),
      })),
    };
  }

  async getNetworthTrend(userId: string) {
    const savingsTrend = await this.getSavingsTrend(userId);
    let running = 0;
    return {
      points: savingsTrend.points.map((point) => {
        running += point.savings;
        return {
          month: point.month,
          networth: running,
        };
      }),
    };
  }

  private rangeConfig(range: SpendingRange) {
    switch (range) {
      case 'weekly':
        return {
          seriesUnit: 'week',
          lookbackInterval: '11 weeks',
          stepInterval: '1 week',
        };
      case 'monthly':
        return {
          seriesUnit: 'month',
          lookbackInterval: '11 months',
          stepInterval: '1 month',
        };
      case 'yearly':
        return {
          seriesUnit: 'year',
          lookbackInterval: '4 years',
          stepInterval: '1 year',
        };
      default:
        return {
          seriesUnit: 'day',
          lookbackInterval: '29 days',
          stepInterval: '1 day',
        };
    }
  }

  private formatBucketLabel(date: Date, range: SpendingRange) {
    if (range === 'yearly') {
      return `${date.getUTCFullYear()}`;
    }
    if (range === 'monthly') {
      return date.toLocaleDateString('en-IN', { month: 'short' });
    }
    if (range === 'weekly') {
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  private monthStart(month: string) {
    const [year, monthValue] = month.split('-').map(Number);
    return new Date(Date.UTC(year, monthValue - 1, 1));
  }

  private nextMonth(monthStart: Date) {
    const next = new Date(monthStart);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
  }
}
