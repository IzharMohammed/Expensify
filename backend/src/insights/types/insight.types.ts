import { Insight } from '../../database/schema';

export type AggregatedInsightInput = {
  analyzedDate: string;
  analyzedMonth: string;
  categoryTotals: Array<{
    category: string;
    current: number;
    previous: number;
    percentageChange: number | null;
    budget: number | null;
    spentRatio: number | null;
  }>;
  dominantDays: Array<{
    dow: number;
    spend: number;
  }>;
  remainingIncome: number;
  spendingVelocity: number;
  projectedOverallSpend: number;
  projectedSavings: number;
  budgetRisks: Array<{
    category: string;
    budget: number;
    projectedSpend: number;
    overshoot: number;
  }>;
  previousInsightTexts: string[];
};

export type GeneratedAiInsight = {
  insight_text: string;
  category: string | null;
  type: 'spending_pattern' | 'comparison' | 'suggestion' | 'prediction';
  priority: 'low' | 'medium' | 'high';
};

export type InsightTimelineEntry = {
  date: string;
  items: Insight[];
};
