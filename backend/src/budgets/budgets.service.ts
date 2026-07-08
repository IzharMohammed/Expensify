import { BadRequestException, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { CategoriesService } from '../categories/categories.service';
import { DrizzleService } from '../database/drizzle.service';
import { budgets, monthlyIncome } from '../database/schema';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';
import { UpsertIncomeDto } from './dto/upsert-income.dto';

@Injectable()
export class BudgetsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async upsertBudget(userId: string, dto: UpsertBudgetDto) {
    const category = await this.categoriesService.findAccessibleById(userId, dto.categoryId);
    if (!category) {
      throw new BadRequestException('Invalid category');
    }

    const month = this.monthStart(dto.month);

    const [budget] = await this.drizzle.db
      .insert(budgets)
      .values({
        userId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        month,
      })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.categoryId, budgets.month],
        set: {
          amount: dto.amount,
        },
      })
      .returning();

    return { budget };
  }

  async upsertIncome(userId: string, dto: UpsertIncomeDto) {
    const month = this.monthStart(dto.month);

    const [income] = await this.drizzle.db
      .insert(monthlyIncome)
      .values({
        userId,
        amount: dto.amount,
        month,
      })
      .onConflictDoUpdate({
        target: [monthlyIncome.userId, monthlyIncome.month],
        set: {
          amount: dto.amount,
        },
      })
      .returning();

    return { income };
  }

  async listMonth(userId: string, month: string) {
    const monthStart = this.monthStart(month);
    const nextMonthStart = new Date(monthStart);
    nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);

    const result = await this.drizzle.db.execute(sql`
      SELECT
        c.id AS "categoryId",
        c.name AS "categoryName",
        c.icon AS icon,
        c.color AS color,
        c.is_default AS "isDefault",
        b.amount::float8 AS "budgetAmount",
        COALESCE(SUM(e.amount::numeric), 0)::float8 AS spent
      FROM categories c
      LEFT JOIN budgets b
        ON b.category_id = c.id
       AND b.user_id = ${userId}
       AND b.month = ${monthStart}
      LEFT JOIN expenses e
        ON e.category_id = c.id
       AND e.user_id = ${userId}
       AND e.date >= ${monthStart}
       AND e.date < ${nextMonthStart}
      WHERE c.user_id IS NULL OR c.user_id = ${userId}
      GROUP BY c.id, c.name, c.icon, c.color, c.is_default, b.amount
      ORDER BY c.is_default DESC, c.name ASC
    `);

    const incomeResult = await this.drizzle.db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0)::float8 AS amount
      FROM monthly_income
      WHERE user_id = ${userId}
        AND month = ${monthStart}
    `);

    return {
      month,
      income: Number((incomeResult.rows[0] as { amount?: number } | undefined)?.amount ?? 0),
      budgets: result.rows.map((row) => {
        const budgetAmount = row.budgetAmount === null ? null : Number(row.budgetAmount);
        const spent = Number(row.spent ?? 0);
        const percentage = budgetAmount && budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

        return {
          categoryId: String(row.categoryId),
          categoryName: String(row.categoryName),
          icon: String(row.icon),
          color: String(row.color),
          isDefault: Boolean(row.isDefault),
          budgetAmount,
          spent,
          percentage,
        };
      }),
    };
  }

  async getBudgetAlertForExpense(userId: string, categoryId: string | null, expenseDate: Date) {
    if (!categoryId) {
      return null;
    }

    const monthStart = new Date(Date.UTC(expenseDate.getUTCFullYear(), expenseDate.getUTCMonth(), 1));
    const nextMonthStart = new Date(monthStart);
    nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);

    const result = await this.drizzle.db.execute(sql`
      SELECT
        c.id AS "categoryId",
        c.name AS "categoryName",
        b.amount::float8 AS "budgetAmount",
        COALESCE(SUM(e.amount::numeric), 0)::float8 AS spent
      FROM budgets b
      INNER JOIN categories c ON c.id = b.category_id
      LEFT JOIN expenses e
        ON e.category_id = b.category_id
       AND e.user_id = ${userId}
       AND e.date >= ${monthStart}
       AND e.date < ${nextMonthStart}
      WHERE b.user_id = ${userId}
        AND b.category_id = ${categoryId}
        AND b.month = ${monthStart}
      GROUP BY c.id, c.name, b.amount
    `);

    const row = result.rows[0] as
      | { categoryId: string; categoryName: string; budgetAmount: number; spent: number }
      | undefined;
    if (!row) {
      return null;
    }

    const budgetAmount = Number(row.budgetAmount);
    const spent = Number(row.spent);
    const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

    if (percentage < 80) {
      return null;
    }

    return {
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      budgetAmount,
      spent,
      percentage,
      threshold: percentage >= 100 ? 100 : 80,
      month: monthStart.toISOString().slice(0, 7),
    } as const;
  }

  private monthStart(month: string) {
    const [year, monthValue] = month.split('-').map(Number);
    return new Date(Date.UTC(year, monthValue - 1, 1));
  }
}
