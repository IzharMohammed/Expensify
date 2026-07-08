import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { monthlyIncome } from '../database/schema';
import { DashboardSummary } from './types/dashboard.types';

@Injectable()
export class DashboardService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getSummary(userId: string): Promise<DashboardSummary> {
    const summaryResult = await this.drizzle.db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN e.date >= date_trunc('day', NOW()) THEN e.amount::numeric ELSE 0 END), 0)::float8 AS today,
        COALESCE(SUM(CASE WHEN e.date >= date_trunc('day', NOW() - interval '1 day') AND e.date < date_trunc('day', NOW()) THEN e.amount::numeric ELSE 0 END), 0)::float8 AS yesterday,
        COALESCE(SUM(CASE WHEN e.date >= date_trunc('week', NOW()) THEN e.amount::numeric ELSE 0 END), 0)::float8 AS "thisWeek",
        COALESCE(SUM(CASE WHEN e.date >= date_trunc('month', NOW()) THEN e.amount::numeric ELSE 0 END), 0)::float8 AS "thisMonth"
      FROM expenses e
      WHERE e.user_id = ${userId}
    `);

    const incomeResult = await this.drizzle.db.execute(sql`
      SELECT COALESCE(SUM(mi.amount::numeric), 0)::float8 AS income
      FROM monthly_income mi
      WHERE mi.user_id = ${userId}
        AND mi.month = date_trunc('month', NOW())
    `);

    const row = summaryResult.rows[0] as
      | { today: number; yesterday: number; thisWeek: number; thisMonth: number }
      | undefined;
    const incomeRow = incomeResult.rows[0] as { income: number } | undefined;

    const today = Number(row?.today ?? 0);
    const yesterday = Number(row?.yesterday ?? 0);
    const thisWeek = Number(row?.thisWeek ?? 0);
    const thisMonth = Number(row?.thisMonth ?? 0);
    const income = Number(incomeRow?.income ?? 0);

    return {
      today,
      yesterday,
      thisWeek,
      thisMonth,
      remaining: income - thisMonth,
    };
  }
}
