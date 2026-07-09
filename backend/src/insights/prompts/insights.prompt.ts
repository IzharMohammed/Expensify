import { AggregatedInsightInput } from '../types/insight.types';

export function buildInsightsPrompt(input: AggregatedInsightInput) {
  return [
    'You are generating concise personal finance insights from aggregated monthly spending data.',
    'Return strict JSON only in this shape:',
    '{"insights":[{"insight_text":string,"category":string|null,"type":"spending_pattern"|"comparison"|"suggestion","priority":"low"|"medium"|"high"}]}',
    'Rules:',
    '1. Generate 3 to 5 insights.',
    '2. Each insight must be 1 or 2 short sentences.',
    '3. Be personalized and actionable. Avoid generic financial advice.',
    '4. Focus on patterns, comparisons, budget pressure, and practical suggestions.',
    '5. If spending patterns have not changed meaningfully, avoid repeating yesterday’s same point.',
    '6. Do not mention raw transaction text, merchants, or unaggregated events.',
    '7. Use INR-style formatting without excessive decimals.',
    '',
    `Aggregated data: ${JSON.stringify(input)}`,
  ].join('\n');
}
