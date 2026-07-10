import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlannerMessage, PlannedToolCall } from './chat.types';

type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

@Injectable()
export class ChatAiService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.groq.com/openai/v1';
  private readonly model = 'llama-3.3-70b-versatile';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('GROQ_API_KEY');
  }

  async planToolCalls(params: {
    systemPrompt: string;
    messages: PlannerMessage[];
    tools: ToolDefinition[];
  }) {
    const json = await this.request({
      model: this.model,
      temperature: 0.1,
      tool_choice: 'auto',
      messages: [{ role: 'system', content: params.systemPrompt }, ...params.messages],
      tools: params.tools,
    });

    const message = json.choices?.[0]?.message;
    if (!message) {
      throw new InternalServerErrorException('Groq planner response was empty');
    }

    const toolCalls =
      message.tool_calls?.flatMap((toolCall: Record<string, unknown>) => {
        const id = typeof toolCall.id === 'string' ? toolCall.id : null;
        const fn = toolCall.function as { name?: string; arguments?: string } | undefined;
        if (!id || !fn?.name || typeof fn.arguments !== 'string') {
          return [];
        }

        try {
          return [
            {
              id,
              name: fn.name as PlannedToolCall['name'],
              arguments: JSON.parse(fn.arguments) as Record<string, unknown>,
            },
          ];
        } catch {
          return [];
        }
      }) ?? [];

    return {
      assistantMessage: {
        role: 'assistant' as const,
        content: typeof message.content === 'string' ? message.content : null,
        tool_calls: toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: 'function' as const,
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.arguments),
          },
        })),
      },
      toolCalls,
    };
  }

  async answerFromToolResults(params: {
    systemPrompt: string;
    messages: PlannerMessage[];
  }) {
    const json = await this.request({
      model: this.model,
      temperature: 0.3,
      messages: [{ role: 'system', content: params.systemPrompt }, ...params.messages],
    });

    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new InternalServerErrorException('Groq answer response was empty');
    }

    return content.trim();
  }

  private async request(payload: Record<string, unknown>) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new InternalServerErrorException(`Groq chat request failed: ${await response.text()}`);
    }

    return (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<Record<string, unknown>>;
        };
      }>;
    };
  }
}
