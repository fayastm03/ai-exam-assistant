/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { loadPrompt } from '../lib/ai/prompts';
import { GeminiProvider } from '../lib/ai/provider';

describe('AI Prompts Loader', () => {
  it('loads prompt from prompts/v1/*.txt and replaces variables', () => {
    const prompt = loadPrompt('ping', { message: 'unit-test-message' });
    expect(prompt).toContain('unit-test-message');
    expect(prompt).not.toContain('{{message}}');
  });

  it('throws helpful error if prompt file does not exist', () => {
    expect(() => loadPrompt('non_existent_prompt')).toThrow('Prompt file not found');
  });
});

describe('GeminiProvider Parsing & Retry Logic', () => {
  const testSchema = z.object({
    status: z.literal('ok'),
    answer: z.number(),
  });

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-3-flash-preview';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('successfully parses valid JSON matching schema on first attempt', async () => {
    const provider = new GeminiProvider();

    // Mock internal client call
    vi.spyOn(provider['client'].models, 'generateContent').mockResolvedValueOnce({
      text: JSON.stringify({ status: 'ok', answer: 42 }),
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    } as any);

    const result = await provider.generateText('test prompt', testSchema);

    expect(result.isFlagged).toBe(false);
    expect(result.data).toEqual({ status: 'ok', answer: 42 });
    expect(result.usage.totalTokens).toBe(15);
  });

  it('retries when JSON is invalid, and succeeds if subsequent attempt is valid', async () => {
    const provider = new GeminiProvider();

    const spy = vi
      .spyOn(provider['client'].models, 'generateContent')
      .mockResolvedValueOnce({
        text: 'This is not JSON at all',
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      } as any)
      .mockResolvedValueOnce({
        text: JSON.stringify({ status: 'ok', answer: 100 }),
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 6, totalTokenCount: 18 },
      } as any);

    const result = await provider.generateText('test prompt', testSchema);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.isFlagged).toBe(false);
    expect(result.data).toEqual({ status: 'ok', answer: 100 });
    expect(result.usage.totalTokens).toBe(33); // 15 + 18
  });

  it('retries twice on persistent invalid JSON, then returns flagged result without throwing', async () => {
    const provider = new GeminiProvider();

    const spy = vi
      .spyOn(provider['client'].models, 'generateContent')
      .mockResolvedValue({
        text: 'malformed non-json',
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      } as any);

    const result = await provider.generateText('test prompt', testSchema);

    // Initial attempt + 2 retries = 3 attempts total
    expect(spy).toHaveBeenCalledTimes(3);
    expect(result.isFlagged).toBe(true);
    expect(result.data).toBeNull();
    expect(result.flagReason).toContain('Invalid JSON');
  });

  it('retries twice on schema mismatch, then returns flagged result without throwing', async () => {
    const provider = new GeminiProvider();

    const spy = vi
      .spyOn(provider['client'].models, 'generateContent')
      .mockResolvedValue({
        text: JSON.stringify({ status: 'not_ok', answer: 'not_a_number' }),
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      } as any);

    const result = await provider.generateText('test prompt', testSchema);

    expect(spy).toHaveBeenCalledTimes(3);
    expect(result.isFlagged).toBe(true);
    expect(result.data).toBeNull();
    expect(result.flagReason).toContain('schema validation failed');
  });
});
