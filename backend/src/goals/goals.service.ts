import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { goalContributions, goals } from '../database/schema';
import { ContributeGoalDto } from './dto/contribute-goal.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalsAiService } from './goals-ai.service';

@Injectable()
export class GoalsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly goalsAiService: GoalsAiService,
  ) {}

  async create(userId: string, dto: CreateGoalDto) {
    if (dto.currentAmount > dto.targetAmount) {
      throw new BadRequestException('Current amount cannot be greater than target amount');
    }

    const [goal] = await this.drizzle.db
      .insert(goals)
      .values({
        userId,
        name: dto.name.trim(),
        targetAmount: dto.targetAmount.toFixed(2),
        currentAmount: dto.currentAmount.toFixed(2),
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
      })
      .returning();

    return { goal: this.serializeGoal(goal) };
  }

  async list(userId: string) {
    const rows = await this.drizzle.db
      .select()
      .from(goals)
      .where(eq(goals.userId, userId))
      .orderBy(desc(goals.createdAt));

    return {
      goals: rows.map((goal) => this.serializeGoal(goal)),
    };
  }

  async getById(userId: string, goalId: string) {
    const goal = await this.requireGoal(userId, goalId);
    const contributions = await this.drizzle.db
      .select()
      .from(goalContributions)
      .where(eq(goalContributions.goalId, goalId))
      .orderBy(desc(goalContributions.date), desc(goalContributions.id));

    return {
      goal: this.serializeGoal(goal),
      contributions: contributions.map((item) => ({
        id: item.id,
        goalId: item.goalId,
        amount: Number(item.amount),
        date: item.date.toISOString(),
        note: item.note,
      })),
    };
  }

  async update(userId: string, goalId: string, dto: UpdateGoalDto) {
    const goal = await this.requireGoal(userId, goalId);
    const nextTargetAmount = dto.targetAmount ?? Number(goal.targetAmount);
    const nextCurrentAmount = dto.currentAmount ?? Number(goal.currentAmount);
    if (nextCurrentAmount > nextTargetAmount) {
      throw new BadRequestException('Current amount cannot be greater than target amount');
    }

    const [updatedGoal] = await this.drizzle.db
      .update(goals)
      .set({
        name: dto.name?.trim() ?? goal.name,
        targetAmount: nextTargetAmount.toFixed(2),
        currentAmount: nextCurrentAmount.toFixed(2),
        targetDate:
          dto.targetDate === undefined
            ? goal.targetDate
            : dto.targetDate
              ? new Date(dto.targetDate)
              : null,
      })
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .returning();

    return { goal: this.serializeGoal(updatedGoal) };
  }

  async remove(userId: string, goalId: string) {
    await this.requireGoal(userId, goalId);
    await this.drizzle.db.delete(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
    return { success: true };
  }

  async contribute(userId: string, goalId: string, dto: ContributeGoalDto) {
    const goal = await this.requireGoal(userId, goalId);
    const nextCurrentAmount = Number(goal.currentAmount) + dto.amount;
    if (nextCurrentAmount > Number(goal.targetAmount)) {
      throw new BadRequestException('Contribution would push this goal above its target amount');
    }

    await this.drizzle.db.transaction(async (tx) => {
      await tx.insert(goalContributions).values({
        goalId,
        amount: dto.amount.toFixed(2),
        date: dto.date ? new Date(dto.date) : new Date(),
        note: dto.note?.trim() || null,
      });

      await tx
        .update(goals)
        .set({
          currentAmount: nextCurrentAmount.toFixed(2),
        })
        .where(eq(goals.id, goalId));
    });

    return this.getById(userId, goalId);
  }

  async getInsight(userId: string, goalId: string) {
    const goal = await this.requireGoal(userId, goalId);
    const remainingAmount = Math.max(0, Number(goal.targetAmount) - Number(goal.currentAmount));
    if (remainingAmount <= 0) {
      return {
        insight: {
          category: null,
          monthlyCut: 0,
          monthsEarlier: 0,
          phrase: `You have already reached ${goal.name}.`,
        },
      };
    }

    const recentCategorySpend = await this.fetchRecentCategorySpend(userId);
    if (recentCategorySpend.length === 0) {
      return {
        insight: {
          category: null,
          monthlyCut: 0,
          monthsEarlier: 0,
          phrase: 'Add a few expenses first so I can suggest the best category cut for this goal.',
        },
      };
    }

    const aiSuggestion = await this.goalsAiService.suggestCut({
      goalName: goal.name,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      remainingAmount,
      recentCategorySpend,
    });

    const matched = recentCategorySpend.find(
      (item) => item.category.trim().toLowerCase() === aiSuggestion.category.trim().toLowerCase(),
    );
    const category = matched?.category ?? recentCategorySpend[0].category;
    const maxReasonableCut = (matched?.monthlySpend ?? recentCategorySpend[0].monthlySpend) * 0.35;
    const monthlyCut = this.clampMonthlyCut(aiSuggestion.monthlyCut, maxReasonableCut);
    const baseMonthlyContribution = await this.estimateMonthlyContribution(
      goalId,
      Number(goal.currentAmount),
      goal.createdAt,
    );
    const monthsEarlier = this.calculateMonthsEarlier(remainingAmount, baseMonthlyContribution, monthlyCut);
    const phrasePrefix =
      aiSuggestion.phrase ||
      `Reduce ${category.toLowerCase()} spending by Rs. ${monthlyCut.toFixed(0)} per month.`;
    const phrase =
      monthsEarlier > 0
        ? `${phrasePrefix.replace(/\.$/, '')} and you'll reach this goal ${monthsEarlier} month${monthsEarlier === 1 ? '' : 's'} earlier.`
        : `${phrasePrefix.replace(/\.$/, '')} and it will strengthen your monthly savings pace, even if it does not change the timeline by a full month yet.`;

    return {
      insight: {
        category,
        monthlyCut,
        monthsEarlier,
        phrase,
      },
    };
  }

  private async requireGoal(userId: string, goalId: string) {
    const [goal] = await this.drizzle.db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    return goal;
  }

  private async fetchRecentCategorySpend(userId: string) {
    const rows = await this.drizzle.db.execute(sql`
      SELECT
        COALESCE(c.name, 'Uncategorized') AS category,
        COALESCE(SUM(e.amount::numeric), 0)::float8 AS "sixtyDaySpend"
      FROM expenses e
      LEFT JOIN categories c ON c.id = e.category_id
      WHERE e.user_id = ${userId}
        AND e.date >= NOW() - INTERVAL '60 days'
      GROUP BY COALESCE(c.name, 'Uncategorized')
      HAVING COALESCE(SUM(e.amount::numeric), 0) > 0
      ORDER BY "sixtyDaySpend" DESC, category ASC
      LIMIT 8
    `);

    return rows.rows.map((row) => ({
      category: String(row.category),
      monthlySpend: Number(row.sixtyDaySpend ?? 0) / 2,
    }));
  }

  private async estimateMonthlyContribution(goalId: string, currentAmount: number, createdAt: Date) {
    const rows = await this.drizzle.db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0)::float8 AS total
      FROM goal_contributions
      WHERE goal_id = ${goalId}
    `);
    const totalContributed = Number((rows.rows[0] as { total?: number } | undefined)?.total ?? 0);
    const contributionBase = totalContributed > 0 ? totalContributed : currentAmount;
    const now = new Date();
    const monthsActive = Math.max(
      1,
      (now.getUTCFullYear() - createdAt.getUTCFullYear()) * 12 +
        (now.getUTCMonth() - createdAt.getUTCMonth()) +
        1,
    );

    return Math.max(1, contributionBase / monthsActive);
  }

  private calculateMonthsEarlier(
    remainingAmount: number,
    baseMonthlyContribution: number,
    monthlyCut: number,
  ) {
    const currentPace = Math.max(1, baseMonthlyContribution);
    const improvedPace = currentPace + Math.max(0, monthlyCut);
    const currentMonths = Math.ceil(remainingAmount / currentPace);
    const improvedMonths = Math.ceil(remainingAmount / improvedPace);
    return Math.max(0, currentMonths - improvedMonths);
  }

  private clampMonthlyCut(monthlyCut: number, maxReasonableCut: number) {
    if (!Number.isFinite(monthlyCut) || monthlyCut <= 0) {
      return Math.max(250, Math.round(maxReasonableCut * 0.4));
    }

    return Math.max(100, Math.min(monthlyCut, Math.max(250, maxReasonableCut)));
  }

  private serializeGoal(goal: typeof goals.$inferSelect) {
    const targetAmount = Number(goal.targetAmount);
    const currentAmount = Number(goal.currentAmount);
    const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

    return {
      id: goal.id,
      userId: goal.userId,
      name: goal.name,
      targetAmount,
      currentAmount,
      targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
      createdAt: goal.createdAt.toISOString(),
      progress: Math.min(100, progress),
      remainingAmount: Math.max(0, targetAmount - currentAmount),
    };
  }
}
