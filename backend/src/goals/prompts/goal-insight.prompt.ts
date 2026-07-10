export function buildGoalInsightPrompt(input: {
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  recentCategorySpend: Array<{ category: string; monthlySpend: number }>;
}) {
  return [
    'You are helping a user reach a savings goal.',
    'Return strict JSON only.',
    'Shape:',
    '{"category":string,"monthly_cut":number,"phrase":string}',
    'Rules:',
    '1. Choose exactly one realistic category from the provided recentCategorySpend list.',
    '2. monthly_cut must be a practical positive monthly reduction number in INR, not more than 35% of that category spend.',
    '3. phrase must be one short sentence explaining the cut naturally.',
    '4. Do not mention months earlier or timeline math. Another system computes that.',
    '5. Do not invent categories outside the provided list.',
    '',
    `Goal data: ${JSON.stringify(input)}`,
  ].join('\n');
}
