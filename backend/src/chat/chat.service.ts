import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import { CategoriesService } from '../categories/categories.service';
import { DrizzleService } from '../database/drizzle.service';
import { chatMessages, monthlyIncome } from '../database/schema';
import { ChatRequestDto } from './dto/chat.dto';
import { ChatAiService } from './chat-ai.service';
import { PlannerMessage, PlannedToolCall } from './chat.types';

const CHAT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_category_total',
      description: 'Get the user spending total for one category in a specific month (YYYY-MM).',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          category: { type: 'string' },
          month: { type: 'string', description: 'Month in YYYY-MM format' },
        },
        required: ['category', 'month'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_months',
      description:
        'Compare spending between two months (YYYY-MM). Returns overall totals plus category deltas.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          monthA: { type: 'string', description: 'First month in YYYY-MM format' },
          monthB: { type: 'string', description: 'Second month in YYYY-MM format' },
        },
        required: ['monthA', 'monthB'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_top_merchants',
      description:
        'Get the highest-spend merchants for one month, including spend and transaction count.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          month: { type: 'string', description: 'Month in YYYY-MM format' },
          limit: { type: 'number', minimum: 1, maximum: 10 },
        },
        required: ['month', 'limit'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'project_savings',
      description:
        'Estimate month-end savings for the current month and compare them to a target amount.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          targetAmount: { type: 'number', minimum: 0 },
        },
        required: ['targetAmount'],
      },
    },
  },
];

@Injectable()
export class ChatService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly categoriesService: CategoriesService,
    private readonly chatAiService: ChatAiService,
  ) {}

  async chat(userId: string, dto: ChatRequestDto) {
    await this.enforceRateLimit(userId);

    const history = await this.drizzle.db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.conversationId, dto.conversationId),
        ),
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(12);

    const orderedHistory = history.reverse();
    const plannerMessages: PlannerMessage[] = [
      ...orderedHistory.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      {
        role: 'user',
        content: dto.message.trim(),
      },
    ];

    const planned = await this.chatAiService.planToolCalls({
      systemPrompt: this.buildPlannerPrompt(),
      messages: plannerMessages,
      tools: CHAT_TOOLS,
    });

    const toolResults = [];
    for (const toolCall of planned.toolCalls.slice(0, 3)) {
      toolResults.push(await this.executeToolCall(userId, toolCall));
    }

    const answerMessages: PlannerMessage[] = [
      ...plannerMessages,
      planned.assistantMessage,
      ...toolResults.map((result) => ({
        role: 'tool' as const,
        tool_call_id: result.id,
        content: JSON.stringify(result.payload),
      })),
    ];

    const answer =
      toolResults.length > 0
        ? await this.chatAiService.answerFromToolResults({
            systemPrompt: this.buildAnswerPrompt(),
            messages: answerMessages,
          })
        : planned.assistantMessage.content?.trim() ||
          'I need a little more detail to answer that from your expense data.';

    await this.drizzle.db.insert(chatMessages).values([
      {
        userId,
        conversationId: dto.conversationId,
        role: 'user',
        content: dto.message.trim(),
      },
      {
        userId,
        conversationId: dto.conversationId,
        role: 'assistant',
        content: answer,
      },
    ]);

    return {
      conversationId: dto.conversationId,
      answer,
      toolResults: toolResults.map((result) => result.payload),
    };
  }

  async listConversation(userId: string, conversationId: string) {
    const messages = await this.drizzle.db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.conversationId, conversationId),
        ),
      )
      .orderBy(asc(chatMessages.createdAt));

    return { messages };
  }

  private async enforceRateLimit(userId: string) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [row] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.role, 'user'),
          gte(chatMessages.createdAt, since),
        ),
      );

    if (Number(row?.count ?? 0) >= 30) {
      throw new HttpException('Chat limit reached. Try again in a while.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async executeToolCall(userId: string, toolCall: PlannedToolCall) {
    switch (toolCall.name) {
      case 'get_category_total':
        return {
          id: toolCall.id,
          payload: await this.getCategoryTotal(
            userId,
            this.readString(toolCall.arguments.category, 'category'),
            this.readMonth(toolCall.arguments.month, 'month'),
          ),
        };
      case 'compare_months':
        return {
          id: toolCall.id,
          payload: await this.compareMonths(
            userId,
            this.readMonth(toolCall.arguments.monthA, 'monthA'),
            this.readMonth(toolCall.arguments.monthB, 'monthB'),
          ),
        };
      case 'get_top_merchants':
        return {
          id: toolCall.id,
          payload: await this.getTopMerchants(
            userId,
            this.readMonth(toolCall.arguments.month, 'month'),
            this.readNumber(toolCall.arguments.limit, 'limit', 1, 10),
          ),
        };
      case 'project_savings':
        return {
          id: toolCall.id,
          payload: await this.projectSavings(
            userId,
            this.readNumber(toolCall.arguments.targetAmount, 'targetAmount', 0),
          ),
        };
      default:
        throw new BadRequestException('Unsupported chat function');
    }
  }

  private async getCategoryTotal(userId: string, categoryName: string, month: string) {
    console.log("calling getCategoryTotal");
    
    const category = await this.resolveCategory(userId, categoryName);
    const monthStart = this.monthStart(month);
    const nextMonthStart = this.nextMonth(monthStart);

    const result = await this.drizzle.db.execute(sql`
      SELECT COALESCE(SUM(e.amount::numeric), 0)::float8 AS total
      FROM expenses e
      WHERE e.user_id = ${userId}
        AND e.category_id = ${category.id}
        AND e.date >= ${monthStart}
        AND e.date < ${nextMonthStart}
    `);

    return {
      function: 'get_category_total',
      category: category.name,
      month,
      total: Number((result.rows[0] as { total?: number } | undefined)?.total ?? 0),
    };
  }

  private async compareMonths(userId: string, monthA: string, monthB: string) {
    console.log("calling compareMonths");
    
    const monthAStart = this.monthStart(monthA);
    const monthBStart = this.monthStart(monthB);
    const monthAEnd = this.nextMonth(monthAStart);
    const monthBEnd = this.nextMonth(monthBStart);

    const result = await this.drizzle.db.execute(sql`
      WITH a AS (
        SELECT c.name AS category, COALESCE(SUM(e.amount::numeric), 0)::float8 AS total
        FROM categories c
        LEFT JOIN expenses e
          ON e.category_id = c.id
         AND e.user_id = ${userId}
         AND e.date >= ${monthAStart}
         AND e.date < ${monthAEnd}
        WHERE c.user_id IS NULL OR c.user_id = ${userId}
        GROUP BY c.name
      ),
      b AS (
        SELECT c.name AS category, COALESCE(SUM(e.amount::numeric), 0)::float8 AS total
        FROM categories c
        LEFT JOIN expenses e
          ON e.category_id = c.id
         AND e.user_id = ${userId}
         AND e.date >= ${monthBStart}
         AND e.date < ${monthBEnd}
        WHERE c.user_id IS NULL OR c.user_id = ${userId}
        GROUP BY c.name
      )
      SELECT
        COALESCE(a.category, b.category) AS category,
        COALESCE(a.total, 0)::float8 AS "monthATotal",
        COALESCE(b.total, 0)::float8 AS "monthBTotal"
      FROM a
      FULL OUTER JOIN b ON a.category = b.category
      ORDER BY ABS(COALESCE(a.total, 0) - COALESCE(b.total, 0)) DESC, COALESCE(a.category, b.category) ASC
    `);

    const totals = await this.drizzle.db.execute(sql`
      SELECT
        (
          SELECT COALESCE(SUM(amount::numeric), 0)::float8
          FROM expenses
          WHERE user_id = ${userId}
            AND date >= ${monthAStart}
            AND date < ${monthAEnd}
        ) AS "monthATotal",
        (
          SELECT COALESCE(SUM(amount::numeric), 0)::float8
          FROM expenses
          WHERE user_id = ${userId}
            AND date >= ${monthBStart}
            AND date < ${monthBEnd}
        ) AS "monthBTotal"
    `);

    return {
      function: 'compare_months',
      monthA,
      monthB,
      totals: {
        monthA: Number((totals.rows[0] as { monthATotal?: number } | undefined)?.monthATotal ?? 0),
        monthB: Number((totals.rows[0] as { monthBTotal?: number } | undefined)?.monthBTotal ?? 0),
      },
      categories: result.rows.slice(0, 8).map((row) => {
        const monthATotal = Number(row.monthATotal ?? 0);
        const monthBTotal = Number(row.monthBTotal ?? 0);
        return {
          category: String(row.category),
          monthATotal,
          monthBTotal,
          delta: monthATotal - monthBTotal,
        };
      }),
    };
  }

  private async getTopMerchants(userId: string, month: string, limit: number) {
    console.log("calling getTopMerchants");
    
    const monthStart = this.monthStart(month);
    const nextMonthStart = this.nextMonth(monthStart);

    const result = await this.drizzle.db.execute(sql`
      SELECT
        e.merchant AS merchant,
        COALESCE(SUM(e.amount::numeric), 0)::float8 AS total,
        COUNT(*)::int AS transactions
      FROM expenses e
      WHERE e.user_id = ${userId}
        AND e.date >= ${monthStart}
        AND e.date < ${nextMonthStart}
      GROUP BY e.merchant
      ORDER BY total DESC, transactions DESC, merchant ASC
      LIMIT ${limit}
    `);

    return {
      function: 'get_top_merchants',
      month,
      limit,
      merchants: result.rows.map((row) => ({
        merchant: String(row.merchant),
        total: Number(row.total ?? 0),
        transactions: Number(row.transactions ?? 0),
      })),
    };
  }

  private async projectSavings(userId: string, targetAmount: number) {
    console.log("calling projectSavings");
    
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = this.nextMonth(monthStart);
    const daysElapsed = Math.max(1, now.getUTCDate());
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();

    const spendResult = await this.drizzle.db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0)::float8 AS total
      FROM expenses
      WHERE user_id = ${userId}
        AND date >= ${monthStart}
        AND date < ${nextMonthStart}
    `);

    const [incomeRow] = await this.drizzle.db
      .select({
        amount: sql<number>`COALESCE(SUM(${monthlyIncome.amount}::numeric), 0)::float8`,
      })
      .from(monthlyIncome)
      .where(and(eq(monthlyIncome.userId, userId), eq(monthlyIncome.month, monthStart)));

    const currentSpend = Number((spendResult.rows[0] as { total?: number } | undefined)?.total ?? 0);
    const income = Number(incomeRow?.amount ?? 0);
    const projectedSpend = (currentSpend / daysElapsed) * daysInMonth;
    const projectedSavings = income - projectedSpend;

    return {
      function: 'project_savings',
      month: monthStart.toISOString().slice(0, 7),
      targetAmount,
      income,
      currentSpend,
      projectedSpend,
      projectedSavings,
      canAffordTarget: projectedSavings >= targetAmount,
    };
  }

  private async resolveCategory(userId: string, categoryName: string) {
    const categories = await this.categoriesService.listForUser(userId);
    const normalized = categoryName.trim().toLowerCase();
    const exact = categories.find((category) => category.name.trim().toLowerCase() === normalized);
    if (exact) {
      return exact;
    }

    const partial = categories.find((category) => category.name.trim().toLowerCase().includes(normalized));
    if (partial) {
      return partial;
    }

    throw new BadRequestException(`Unknown category "${categoryName}"`);
  }

  private buildPlannerPrompt() {
    return [
      'You are a financial analytics planner for an expense tracker.',
      'Your job is only to choose safe finance tools for grounded answers.',
      'Never invent transaction data. If the user asks about money, spending, merchants, trends, or affordability, call one or more tools.',
      'Prefer YYYY-MM month arguments. Infer relative months from conversation when obvious.',
      'If a target savings question is asked, call project_savings.',
      'If the user asks for comparison, call compare_months.',
      'If the user asks about a category, call get_category_total.',
      'If the user asks where money is going, call get_top_merchants and optionally compare_months.',
      'If the prompt is just a greeting, reply briefly without calling tools.',
    ].join(' ');
  }

  private buildAnswerPrompt() {
    return [
      'You are a spending assistant answering only from tool outputs.',
      'Use the tool results as the source of truth and do not invent facts.',
      'Be concise, practical, and specific with numbers when available.',
      'If data is missing or zero, say that plainly.',
      'Do not mention SQL, tools, or internal implementation.',
    ].join(' ');
  }

  private readString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`Invalid ${field}`);
    }

    return value.trim();
  }

  private readMonth(value: unknown, field: string) {
    const month = this.readString(value, field);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException(`Invalid ${field}`);
    }

    return month;
  }

  private readNumber(value: unknown, field: string, min: number, max = Number.MAX_SAFE_INTEGER) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(`Invalid ${field}`);
    }

    return parsed;
  }

  private monthStart(month: string) {
    const [year, monthValue] = month.split('-').map(Number);
    return new Date(Date.UTC(year, monthValue - 1, 1));
  }

  private nextMonth(monthStart: Date) {
    const nextMonthStart = new Date(monthStart);
    nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);
    return nextMonthStart;
  }
}
