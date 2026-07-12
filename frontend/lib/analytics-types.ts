export type SpendingPoint = {
  bucket: string;
  total: number;
  label: string;
};

export type CategoryDistributionItem = {
  category: string;
  total: number;
};

export type HeatmapDay = {
  date: string;
  total: number;
};

export type SavingsTrendPoint = {
  month: string;
  income: number;
  spend: number;
  savings: number;
};

export type NetworthTrendPoint = {
  month: string;
  networth: number;
};
