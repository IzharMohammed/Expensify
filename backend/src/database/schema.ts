import {
  boolean,
  date as pgDate,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const authProviderEnum = pgEnum('auth_provider', ['local', 'google']);
export const paymentMethodEnum = pgEnum('payment_method', ['upi', 'card', 'cash', 'netbanking']);
export const expenseSourceEnum = pgEnum('expense_source', ['text', 'voice', 'ocr', 'manual']);
export const insightTypeEnum = pgEnum('insight_type', [
  'spending_pattern',
  'comparison',
  'suggestion',
  'prediction',
]);
export const insightPriorityEnum = pgEnum('insight_priority', ['low', 'medium', 'high']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  authProvider: authProviderEnum('auth_provider').notNull().default('local'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revoked: boolean('revoked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
  },
  (table) => ({
    categoriesUserIdIdx: index('categories_user_id_idx').on(table.userId),
  }),
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    merchant: text('merchant').notNull(),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    paymentMethod: paymentMethodEnum('payment_method'),
    date: timestamp('date', { withTimezone: true }).notNull(),
    note: text('note'),
    source: expenseSourceEnum('source').notNull().default('manual'),
    rawInput: text('raw_input'),
    receiptUrl: text('receipt_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    expensesUserIdIdx: index('expenses_user_id_idx').on(table.userId),
    expensesCategoryIdIdx: index('expenses_category_id_idx').on(table.categoryId),
    expensesDateIdx: index('expenses_date_idx').on(table.date),
  }),
);

export const budgets = pgTable(
  'budgets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    month: timestamp('month', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    budgetsUserMonthIdx: index('budgets_user_month_idx').on(table.userId, table.month),
    budgetsUniqueMonth: uniqueIndex('budgets_user_category_month_unique').on(
      table.userId,
      table.categoryId,
      table.month,
    ),
  }),
);

export const monthlyIncome = pgTable(
  'monthly_income',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    month: timestamp('month', { withTimezone: true }).notNull(),
  },
  (table) => ({
    monthlyIncomeUniqueMonth: uniqueIndex('monthly_income_user_month_unique').on(
      table.userId,
      table.month,
    ),
  }),
);

export const insights = pgTable(
  'insights',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: pgDate('date', { mode: 'date' }).notNull(),
    month: pgDate('month', { mode: 'date' }).notNull(),
    insightText: text('insight_text').notNull(),
    category: text('category'),
    type: insightTypeEnum('type').notNull(),
    priority: insightPriorityEnum('priority').notNull().default('medium'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    insightsUserDateIdx: index('insights_user_date_idx').on(table.userId, table.date),
    insightsUserMonthIdx: index('insights_user_month_idx').on(table.userId, table.month),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type MonthlyIncome = typeof monthlyIncome.$inferSelect;
export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
