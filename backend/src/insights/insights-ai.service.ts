import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildInsightsPrompt } from './prompts/insights.prompt';
import { AggregatedInsightInput, GeneratedAiInsight } from './types/insight.types';

const ALLOWED_TYPES = new Set<GeneratedAiInsight['type']>([
  'spending_pattern',
  'comparison',
  'suggestion',
  'prediction',
]);

const ALLOWED_PRIORITIES = new Set<GeneratedAiInsight['priority']>(['low', 'medium', 'high']);

@Injectable()
export class InsightsAiService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.groq.com/openai/v1';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('GROQ_API_KEY');
  }

  async generateInsights(input: AggregatedInsightInput): Promise<GeneratedAiInsight[]> {
    const systemPrompt = buildInsightsPrompt(input);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate insights.' },
        ],
      }),
    });

    if (!response.ok) {
      throw new InternalServerErrorException(`Groq insights request failed: ${await response.text()}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new InternalServerErrorException('Groq insights response was empty');
    }

    try {
      const parsed = JSON.parse(content) as { insights?: GeneratedAiInsight[] };
      return (parsed.insights ?? [])
        .map((insight) => this.normalizeInsight(insight))
        .filter((insight): insight is GeneratedAiInsight => insight !== null)
        .slice(0, 5);
    } catch {
      throw new InternalServerErrorException('Groq insights response was invalid JSON');
    }
  }

  private normalizeInsight(insight: Partial<GeneratedAiInsight> | null | undefined) {
    if (!insight || typeof insight.insight_text !== 'string' || !insight.insight_text.trim()) {
      return null;
    }

    const normalizedType = this.normalizeType(insight.type);
    const normalizedPriority = ALLOWED_PRIORITIES.has(insight.priority as GeneratedAiInsight['priority'])
      ? (insight.priority as GeneratedAiInsight['priority'])
      : 'medium';

    return {
      insight_text: insight.insight_text.trim(),
      category: typeof insight.category === 'string' && insight.category.trim() ? insight.category.trim() : null,
      type: normalizedType,
      priority: normalizedPriority,
    } satisfies GeneratedAiInsight;
  }

  private normalizeType(type: unknown): GeneratedAiInsight['type'] {
    if (typeof type === 'string' && ALLOWED_TYPES.has(type as GeneratedAiInsight['type'])) {
      return type as GeneratedAiInsight['type'];
    }

    if (type === 'budget_pressure' || type === 'warning' || type === 'alert') {
      return 'suggestion';
    }

    return 'suggestion';
  }
}
