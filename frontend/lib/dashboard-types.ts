export type DashboardSummary = {
  today: number;
  yesterday: number;
  thisWeek: number;
  thisMonth: number;
  remaining: number;
};

export type BudgetRow = {
  categoryId: string;
  categoryName: string;
  icon: string;
  color: string;
  isDefault: boolean;
  budgetAmount: number | null;
  spent: number;
  percentage: number;
};

export type BudgetListResponse = {
  month: string;
  income: number;
  budgets: BudgetRow[];
};

export type BudgetAlert = {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spent: number;
  percentage: number;
  threshold: 80 | 100;
  month: string;
};

export type AppNotification = {
  id: string;
  userId: string;
  recurringExpenseId: string | null;
  type: 'budget_alert' | 'recurring_due' | 'no_spend_today' | 'anomaly_alert';
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type InsightRecord = {
  id: string;
  userId: string;
  date: string;
  month: string;
  insightText: string;
  category: string | null;
  type: 'spending_pattern' | 'comparison' | 'suggestion' | 'prediction';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
};

export type InsightHistoryResponse = {
  items: InsightRecord[];
  page: number;
  limit: number;
  total: number;
};
