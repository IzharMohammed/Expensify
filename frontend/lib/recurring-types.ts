export type RecurringExpenseRecord = {
  id: string;
  userId: string;
  merchant: string;
  amount: number;
  categoryId: string | null;
  frequency: 'monthly' | 'weekly' | 'yearly';
  nextDueDate: string;
  isAutoDetected: boolean;
  isConfirmed: boolean;
  createdAt: string;
  monthlyEquivalent: number;
};

export type RecurringReminder = {
  id: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  recurringExpenseId: string | null;
};

export type RecurringListResponse = {
  recurringExpenses: RecurringExpenseRecord[];
  pendingDetections: RecurringExpenseRecord[];
  monthlyTotal: number;
  reminders: RecurringReminder[];
};
