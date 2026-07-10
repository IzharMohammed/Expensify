import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildGoalInsightPrompt } from './prompts/goal-insight.prompt';

@Injectable()
export class GoalsAiService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.groq.com/openai/v1';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('GROQ_API_KEY');
  }

  async suggestCut(input: {
    goalName: string;
    targetAmount: number;
    currentAmount: number;
    remainingAmount: number;
    recentCategorySpend: Array<{ category: string; monthlySpend: number }>;
  }) {
    const systemPrompt = buildGoalInsightPrompt(input);
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
          { role: 'user', content: 'Suggest the best single category cut.' },
        ],
      }),
    });

    if (!response.ok) {
      throw new InternalServerErrorException(`Groq goal insight request failed: ${await response.text()}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new InternalServerErrorException('Groq goal insight response was empty');
    }

    try {
      const parsed = JSON.parse(content) as {
        category?: string;
        monthly_cut?: number | string;
        phrase?: string;
      };

      return {
        category: typeof parsed.category === 'string' ? parsed.category.trim() : '',
        monthlyCut:
          typeof parsed.monthly_cut === 'number'
            ? parsed.monthly_cut
            : Number(String(parsed.monthly_cut ?? '').trim()),
        phrase: typeof parsed.phrase === 'string' ? parsed.phrase.trim() : '',
      };
    } catch {
      throw new InternalServerErrorException('Groq goal insight response was invalid JSON');
    }
  }
}
