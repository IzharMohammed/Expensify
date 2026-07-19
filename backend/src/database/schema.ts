import {
  boolean,
  date as pgDate,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const authProviderEnum = pgEnum('auth_provider', ['local', 'google']);
export const paymentMethodEnum = pgEnum('payment_method', ['upi', 'card', 'cash', 'netbanking']);
export const expenseSourceEnum = pgEnum('expense_source', ['text', 'voice', 'ocr', 'manual']);
export const attachmentFileTypeEnum = pgEnum('attachment_file_type', ['image', 'pdf']);
export const attachmentLabelEnum = pgEnum('attachment_label', [
  'receipt',
  'invoice',
  'warranty',
  'other',
]);
export const insightTypeEnum = pgEnum('insight_type', [
  'spending_pattern',
  'comparison',
  'suggestion',
  'prediction',
]);
export const insightPriorityEnum = pgEnum('insight_priority', ['low', 'medium', 'high']);
export const chatRoleEnum = pgEnum('chat_role', ['user', 'assistant']);
export const recurringFrequencyEnum = pgEnum('recurring_frequency', ['monthly', 'weekly', 'yearly']);
export const notificationTypeEnum = pgEnum('notification_type', [
  'budget_alert',
  'recurring_due',
  'no_spend_today',
  'anomaly_alert',
]);
export const householdRoleEnum = pgEnum('household_role', ['owner', 'member']);
export const settlementStatusEnum = pgEnum('settlement_status', ['pending', 'settled']);

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

export const households = pgTable(
  'households',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    householdsOwnerIdIdx: index('households_owner_id_idx').on(table.ownerId),
  }),
);

export const householdMembers = pgTable(
  'household_members',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: householdRoleEnum('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    householdMembersUnique: uniqueIndex('household_members_household_user_unique').on(
      table.householdId,
      table.userId,
    ),
    householdMembersUserIdIdx: index('household_members_user_id_idx').on(table.userId),
  }),
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    householdId: uuid('household_id').references(() => households.id, { onDelete: 'set null' }),
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
    expensesHouseholdIdIdx: index('expenses_household_id_idx').on(table.householdId),
  }),
);

export const expenseSplits = pgTable(
  'expense_splits',
  {
    expenseId: uuid('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  },
  (table) => ({
    expenseSplitsUnique: uniqueIndex('expense_splits_expense_user_unique').on(
      table.expenseId,
      table.userId,
    ),
    expenseSplitsUserIdIdx: index('expense_splits_user_id_idx').on(table.userId),
  }),
);

export const settlements = pgTable(
  'settlements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    fromUserId: uuid('from_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toUserId: uuid('to_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    status: settlementStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    settlementsHouseholdStatusIdx: index('settlements_household_status_idx').on(
      table.householdId,
      table.status,
    ),
  }),
);

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    expenseId: uuid('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    fileUrl: text('file_url').notNull(),
    fileType: attachmentFileTypeEnum('file_type').notNull(),
    label: attachmentLabelEnum('label').notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    attachmentsExpenseUploadedIdx: index('attachments_expense_uploaded_idx').on(
      table.expenseId,
      table.uploadedAt,
    ),
  }),
);

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
  },
  (table) => ({
    tagsUserIdIdx: index('tags_user_id_idx').on(table.userId),
    tagsUserLowerNameUnique: uniqueIndex('tags_user_lower_name_unique').on(
      table.userId,
      sql`lower(${table.name})`,
    ),
  }),
);

export const expenseTags = pgTable(
  'expense_tags',
  {
    expenseId: uuid('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    expenseTagsUnique: uniqueIndex('expense_tags_expense_tag_unique').on(
      table.expenseId,
      table.tagId,
    ),
    expenseTagsTagIdIdx: index('expense_tags_tag_id_idx').on(table.tagId),
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

export const streaks = pgTable('streaks', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastQualifyingDate: pgDate('last_qualifying_date', { mode: 'date' }),
});

export const badges = pgTable('badges', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
});

export const userBadges = pgTable(
  'user_badges',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    badgeId: uuid('badge_id')
      .notNull()
      .references(() => badges.id, { onDelete: 'cascade' }),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userBadgesUnique: uniqueIndex('user_badges_user_badge_unique').on(
      table.userId,
      table.badgeId,
    ),
    userBadgesUserEarnedIdx: index('user_badges_user_earned_idx').on(
      table.userId,
      table.earnedAt,
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

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id').notNull(),
    role: chatRoleEnum('role').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    chatMessagesUserConversationIdx: index('chat_messages_user_conversation_idx').on(
      table.userId,
      table.conversationId,
      table.createdAt,
    ),
    chatMessagesUserCreatedIdx: index('chat_messages_user_created_idx').on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    targetAmount: numeric('target_amount', { precision: 12, scale: 2 }).notNull(),
    currentAmount: numeric('current_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    targetDate: timestamp('target_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    goalsUserCreatedIdx: index('goals_user_created_idx').on(table.userId, table.createdAt),
  }),
);

export const goalContributions = pgTable(
  'goal_contributions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    note: text('note'),
  },
  (table) => ({
    goalContributionsGoalDateIdx: index('goal_contributions_goal_date_idx').on(
      table.goalId,
      table.date,
    ),
  }),
);

export const recurringExpenses = pgTable(
  'recurring_expenses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    merchant: text('merchant').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    frequency: recurringFrequencyEnum('frequency').notNull(),
    nextDueDate: timestamp('next_due_date', { withTimezone: true }).notNull(),
    isAutoDetected: boolean('is_auto_detected').notNull().default(true),
    isConfirmed: boolean('is_confirmed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    recurringExpensesUserConfirmedIdx: index('recurring_expenses_user_confirmed_idx').on(
      table.userId,
      table.isConfirmed,
      table.nextDueDate,
    ),
    recurringExpensesCategoryIdx: index('recurring_expenses_category_idx').on(table.categoryId),
  }),
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recurringExpenseId: uuid('recurring_expense_id').references(() => recurringExpenses.id, {
      onDelete: 'cascade',
    }),
    type: notificationTypeEnum('type').notNull(),
    message: text('message').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    notificationsUserCreatedIdx: index('notifications_user_created_idx').on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type ExpenseTag = typeof expenseTags.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type MonthlyIncome = typeof monthlyIncome.$inferSelect;
export type Streak = typeof streaks.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type UserBadge = typeof userBadges.$inferSelect;
export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type GoalContribution = typeof goalContributions.$inferSelect;
export type NewGoalContribution = typeof goalContributions.$inferInsert;
export type RecurringExpense = typeof recurringExpenses.$inferSelect;
export type NewRecurringExpense = typeof recurringExpenses.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
