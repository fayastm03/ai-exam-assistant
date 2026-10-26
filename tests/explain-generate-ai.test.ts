import { describe, it, expect } from 'vitest';
import { loadPrompt } from '@/lib/ai/prompts';
import {
  explainQuestionsResponseSchema,
  generatedQuestionsResponseSchema,
  generateFromNotesInputSchema,
} from '@/lib/validations/ai';

describe('Phase 5c: AI Prompts and Validation Schemas', () => {
  describe('Explain Prompt & Schema', () => {
    it('loads explain.txt prompt and verifies key instructions', () => {
      const prompt = loadPrompt('explain');
      expect(prompt).toContain('academic evaluator');
      expect(prompt).toContain('flag');
      expect(prompt).toContain('flag_reason');
      expect(prompt).toContain('Do NOT attempt to alter the question\'s designated "correct_option"');
    });

    it('validates a successful explain response with unflagged questions', () => {
      const validPayload = {
        questions: [
          {
            number: 1,
            explanation: 'Option A is correct because the acceleration due to gravity is 9.8 m/s^2.',
            flag: false,
            flag_reason: null,
          },
        ],
      };

      const parsed = explainQuestionsResponseSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.questions[0].flag).toBe(false);
        expect(parsed.data.questions[0].flag_reason).toBeNull();
      }
    });

    it('validates an explain response with flagged question and reason', () => {
      const flaggedPayload = {
        questions: [
          {
            number: 2,
            explanation: 'The question appears to have an incorrect designated answer.',
            flag: true,
            flag_reason: 'Designated option is B, but Newton\'s second law gives C.',
          },
        ],
      };

      const parsed = explainQuestionsResponseSchema.safeParse(flaggedPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.questions[0].flag).toBe(true);
        expect(parsed.data.questions[0].flag_reason).toContain('Newton\'s second law');
      }
    });

    it('rejects an explain response with missing explanations or empty objects', () => {
      const invalidPayload = {
        questions: [
          {
            number: 1,
            explanation: '',
          },
        ],
      };

      const parsed = explainQuestionsResponseSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });
  });

  describe('Generate Prompt & Schema', () => {
    it('loads generate.txt and correctly replaces {{count}} and {{level}} placeholders', () => {
      const prompt = loadPrompt('generate', {
        count: '12',
        level: 'hard',
      });

      expect(prompt).toContain('Number of Questions to generate: 12');
      expect(prompt).toContain('Target Difficulty Level: hard');
      expect(prompt).not.toContain('{{count}}');
      expect(prompt).not.toContain('{{level}}');
    });

    it('validates generated questions schema with valid MCQs', () => {
      const validPayload = {
        questions: [
          {
            text: 'What is the SI unit of electric capacitance?',
            options: [
              { id: 'A', text: 'Farad' },
              { id: 'B', text: 'Henry' },
              { id: 'C', text: 'Ohm' },
              { id: 'D', text: 'Volt' },
            ],
            correct_option: 'A',
            marks: 1,
            topic: 'Electricity',
            explanation: 'The SI unit of capacitance is the Farad (F), named after Michael Faraday.',
          },
        ],
      };

      const parsed = generatedQuestionsResponseSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.questions[0].correct_option).toBe('A');
        expect(parsed.data.questions[0].options).toHaveLength(4);
      }
    });

    it('rejects questions with fewer than 2 options', () => {
      const invalidPayload = {
        questions: [
          {
            text: 'Is this invalid?',
            options: [{ id: 'A', text: 'Only one option' }],
            correct_option: 'A',
          },
        ],
      };

      const parsed = generatedQuestionsResponseSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });
  });

  describe('Generate Input Parameters Validation', () => {
    it('accepts valid count and level', () => {
      const input = {
        count: 10,
        level: 'hard',
        text: 'Some notes content',
      };

      const parsed = generateFromNotesInputSchema.safeParse(input);
      expect(parsed.success).toBe(true);
    });

    it('rejects count greater than 20 or less than 1', () => {
      const overMax = generateFromNotesInputSchema.safeParse({ count: 25, level: 'medium' });
      expect(overMax.success).toBe(false);

      const underMin = generateFromNotesInputSchema.safeParse({ count: 0, level: 'medium' });
      expect(underMin.success).toBe(false);
    });

    it('rejects invalid difficulty levels', () => {
      const invalidLevel = generateFromNotesInputSchema.safeParse({
        count: 5,
        level: 'insane',
      });
      expect(invalidLevel.success).toBe(false);
    });

    it('rejects text exceeding 50,000 characters', () => {
      const tooLong = generateFromNotesInputSchema.safeParse({
        count: 5,
        level: 'easy',
        text: 'x'.repeat(50001),
      });
      expect(tooLong.success).toBe(false);
    });
  });
});
