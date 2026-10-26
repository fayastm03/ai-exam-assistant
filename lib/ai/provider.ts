import 'server-only';

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

export interface AIUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  latencyMs: number;
}

export interface AIResult<T> {
  data: T | null;
  rawText: string;
  isFlagged: boolean;
  flagReason?: string;
  usage: AIUsage;
}

export interface AIFileInput {
  buffer: Buffer | Uint8Array;
  mimeType: string;
  name?: string;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;

  /**
   * Generates structured text response from a text prompt.
   * Parses output against provided Zod schema.
   * Retries twice on invalid JSON/schema, then returns a flagged result instead of throwing.
   */
  generateText<T = unknown>(
    prompt: string,
    schema?: z.ZodType<T>
  ): Promise<AIResult<T>>;

  /**
   * Extracts information from an uploaded file (PDF, image, doc) using a multimodal prompt.
   * Parses output against provided Zod schema.
   * Retries twice on invalid JSON/schema, then returns a flagged result instead of throwing.
   */
  extractFromFile<T = unknown>(
    file: AIFileInput,
    prompt: string,
    schema?: z.ZodType<T>
  ): Promise<AIResult<T>>;
}

/**
 * Strips markdown code fences (```json ... ```) from model output.
 */
function cleanJsonOutput(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
  }
  return cleaned.trim();
}

/**
 * Checks whether an error represents a rate limit or quota issue.
 */
function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  const status = typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status: unknown }).status) : 0;
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('too many requests')
  );
}

/**
 * Sleep helper for exponential backoff.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  readonly model: string;
  private readonly client: GoogleGenAI;
  private readonly temperature = 0.2;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is missing. Please set it in .env.local.'
      );
    }

    // Read model from GEMINI_MODEL or fallback to gemini-3-flash-preview
    const envModel = process.env.GEMINI_MODEL;
    const providerEnv = process.env.AI_PROVIDER;
    this.model =
      envModel ||
      (providerEnv && providerEnv.startsWith('gemini-')
        ? providerEnv
        : 'gemini-3-flash-preview');

    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * Low-level call to Gemini API with exponential backoff on rate-limit errors.
   */
  private async executeWithRateLimitRetry(
    contents: unknown[]
  ): Promise<{ text: string; usage: AIUsage }> {
    const maxRateLimitRetries = 3;
    const baseDelay = 1500;

    for (let attempt = 0; attempt <= maxRateLimitRetries; attempt++) {
      const startTime = performance.now();
      try {
        const response = await this.client.models.generateContent({
          model: this.model,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          contents: contents as any,
          config: {
            temperature: this.temperature,
            responseMimeType: 'application/json',
          },
        });

        const latencyMs = Math.round(performance.now() - startTime);
        const text = response.text || '';
        const usageMeta = response.usageMetadata;

        const usage: AIUsage = {
          promptTokens: usageMeta?.promptTokenCount || 0,
          candidatesTokens: usageMeta?.candidatesTokenCount || 0,
          totalTokens: usageMeta?.totalTokenCount || 0,
          latencyMs,
        };

        // Token and latency logging for every call
        console.log(
          `[AI:${this.name}:${this.model}] Latency: ${usage.latencyMs}ms | Tokens: prompt=${usage.promptTokens}, candidates=${usage.candidatesTokens}, total=${usage.totalTokens}`
        );

        return { text, usage };
      } catch (err: unknown) {
        if (isRateLimitError(err) && attempt < maxRateLimitRetries) {
          const jitter = Math.random() * 500;
          const delay = baseDelay * Math.pow(2, attempt) + jitter;
          console.warn(
            `[AI:${this.name}:${this.model}] Rate limit encountered (attempt ${attempt + 1}/${maxRateLimitRetries + 1}). Backing off for ${Math.round(delay)}ms...`
          );
          await sleep(delay);
          continue;
        }
        throw err;
      }
    }

    throw new Error(`[AI:${this.name}:${this.model}] Exceeded maximum rate-limit retries.`);
  }

  /**
   * Helper that parses raw text with Zod schema and handles up to 2 retries on invalid JSON/schema,
   * returning a flagged result on failure instead of throwing.
   */
  private async parseAndValidateWithRetry<T>(
    baseContents: unknown[],
    schema?: z.ZodType<T>
  ): Promise<AIResult<T>> {
    const maxParseRetries = 2; // 1 initial attempt + 2 retries = 3 total attempts
    let currentContents = [...baseContents];
    let aggregatedUsage: AIUsage = {
      promptTokens: 0,
      candidatesTokens: 0,
      totalTokens: 0,
      latencyMs: 0,
    };
    let lastRawText = '';
    let lastError = '';

    for (let retry = 0; retry <= maxParseRetries; retry++) {
      const { text, usage } = await this.executeWithRateLimitRetry(currentContents);

      // Aggregate token counts and latency across retries
      aggregatedUsage = {
        promptTokens: aggregatedUsage.promptTokens + usage.promptTokens,
        candidatesTokens: aggregatedUsage.candidatesTokens + usage.candidatesTokens,
        totalTokens: aggregatedUsage.totalTokens + usage.totalTokens,
        latencyMs: aggregatedUsage.latencyMs + usage.latencyMs,
      };

      lastRawText = text;

      // 1. Parse JSON
      let parsedJson: unknown;
      try {
        const cleaned = cleanJsonOutput(text);
        parsedJson = JSON.parse(cleaned);
      } catch (parseErr: unknown) {
        lastError = parseErr instanceof Error ? parseErr.message : 'Invalid JSON format';
        console.warn(
          `[AI:${this.name}:${this.model}] JSON parse failed (attempt ${retry + 1}/${maxParseRetries + 1}): ${lastError}`
        );

        if (retry < maxParseRetries) {
          currentContents = [
            ...baseContents,
            `The previous response was not valid JSON (${lastError}). Please output ONLY valid, parseable JSON matching the required structure without any commentary.`,
          ];
          continue;
        }
        break;
      }

      // 2. Validate against Zod schema (if supplied)
      if (schema) {
        const validation = schema.safeParse(parsedJson);
        if (!validation.success) {
          lastError = validation.error.message;
          console.warn(
            `[AI:${this.name}:${this.model}] Zod validation failed (attempt ${retry + 1}/${maxParseRetries + 1}): ${lastError}`
          );

          if (retry < maxParseRetries) {
            currentContents = [
              ...baseContents,
              `The previous JSON response did not match the required schema: ${lastError}. Please correct the fields and output valid JSON.`,
            ];
            continue;
          }
          break;
        }

        return {
          data: validation.data,
          rawText: text,
          isFlagged: false,
          usage: aggregatedUsage,
        };
      }

      // No schema provided, return parsed JSON
      return {
        data: parsedJson as T,
        rawText: text,
        isFlagged: false,
        usage: aggregatedUsage,
      };
    }

    // After 2 retries: return flagged result instead of throwing
    console.error(
      `[AI:${this.name}:${this.model}] Output failed validation after ${maxParseRetries} retries. Returning flagged result.`
    );

    return {
      data: null,
      rawText: lastRawText,
      isFlagged: true,
      flagReason: `Invalid JSON or schema validation failed after ${maxParseRetries} retries: ${lastError}`,
      usage: aggregatedUsage,
    };
  }

  async generateText<T = unknown>(
    prompt: string,
    schema?: z.ZodType<T>
  ): Promise<AIResult<T>> {
    return this.parseAndValidateWithRetry<T>([prompt], schema);
  }

  async extractFromFile<T = unknown>(
    file: AIFileInput,
    prompt: string,
    schema?: z.ZodType<T>
  ): Promise<AIResult<T>> {
    const inlinePart = {
      inlineData: {
        data: Buffer.from(file.buffer).toString('base64'),
        mimeType: file.mimeType,
      },
    };

    return this.parseAndValidateWithRetry<T>([inlinePart, prompt], schema);
  }
}

/**
 * AI Provider Factory.
 * Chooses provider implementation based on AI_PROVIDER environment variable.
 */
export function getAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

  if (provider.startsWith('gemini')) {
    return new GeminiProvider();
  }

  throw new Error(
    `Unsupported AI_PROVIDER: "${provider}". Currently supported providers: gemini.`
  );
}
