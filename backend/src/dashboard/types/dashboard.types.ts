export type DashboardSummary = {
  today: number;
  yesterday: number;
  thisWeek: number;
  thisMonth: number;
  remaining: number;
};

export type DashboardStreamEvent =
  | {
      type: 'summary';
      data: DashboardSummary;
    }
  | {
      type: 'budget_alert';
      data: {
        categoryId: string;
        categoryName: string;
        budgetAmount: number;
        spent: number;
        percentage: number;
        threshold: 80 | 100;
        month: string;
      };
    };
