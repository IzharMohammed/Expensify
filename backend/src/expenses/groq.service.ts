import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pdfParse from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { buildExpenseParserPrompt } from './prompts/expense-parser.prompt';
import { buildReceiptPrompt } from './prompts/receipt-ocr.prompt';
import { ParsedExpenseDraft, ParsedReceiptDraft } from './types/expense.types';

@Injectable()
export class GroqService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.groq.com/openai/v1';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('GROQ_API_KEY');
  }

  async parseExpenseText(params: {
    text: string;
    categoryNames: string[];
    todayIsoDate: string;
  }): Promise<ParsedExpenseDraft> {
    console.log("params.categoryNames",params.categoryNames);
    console.log("params.todayIsoDate",params.todayIsoDate);
    
    const systemPrompt = buildExpenseParserPrompt({
      categoryNames: params.categoryNames,
      todayIsoDate: params.todayIsoDate,
    });

    const response = await this.requestJson<ParsedExpenseDraft>({
      endpoint: '/chat/completions',
      payload: {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: params.text },
        ],
      },
    });
    console.log("response",response);
    return response;
  }

  async transcribeAudio(file: Express.Multer.File): Promise<string> {
    const form = new FormData();
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'verbose_json');
    const bytes = new Uint8Array(file.buffer);
    form.append('file', new Blob([bytes], { type: file.mimetype }), file.originalname);

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      throw new InternalServerErrorException('Groq transcription failed');
    }

    const json = (await response.json()) as { text?: string };
    if (!json.text) {
      throw new InternalServerErrorException('Groq transcription returned empty text');
    }

    return json.text;
  }

  async parseReceipt(params: {
    text: string;
    categoryNames: string[];
    todayIsoDate: string;
  }): Promise<ParsedReceiptDraft> {
    const systemPrompt = buildReceiptPrompt({
      categoryNames: params.categoryNames,
      todayIsoDate: params.todayIsoDate,
    });

    return this.requestJson<ParsedReceiptDraft>({
      endpoint: '/chat/completions',
      payload: {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: params.text },
        ],
      },
    });
  }

  async extractTextFromReceipt(file: Express.Multer.File): Promise<string> {
    if (file.mimetype === 'application/pdf') {
      const parsed = await pdfParse(file.buffer);
      return parsed.text.trim();
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image and PDF uploads are supported');
    }

    const worker = await createWorker('eng');
    try {
      const result = await worker.recognize(file.buffer);
      return result.data.text.trim();
    } finally {
      await worker.terminate();
    }
  }

  private async requestJson<T>(params: { endpoint: string; payload: unknown }): Promise<T> {
    const response = await fetch(`${this.baseUrl}${params.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(params.payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new InternalServerErrorException(`Groq request failed: ${body}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new InternalServerErrorException('Groq response was empty');
    }

    try {
      return JSON.parse(content) as T;
    } catch {
      throw new InternalServerErrorException('Groq returned invalid JSON');
    }
  }
}
