export type GoalRecord = {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  createdAt: string;
  progress: number;
  remainingAmount: number;
};

export type GoalContribution = {
  id: string;
  goalId: string;
  amount: number;
  date: string;
  note: string | null;
};

export type GoalInsight = {
  category: string | null;
  monthlyCut: number;
  monthsEarlier: number;
  phrase: string;
};
