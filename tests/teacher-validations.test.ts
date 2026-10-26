import { describe, it, expect } from 'vitest';
import {
  examCreateSchema,
  questionCreateSchema,
  bulkParseSchema,
} from '@/lib/validations/teacher';

describe('lib/validations/teacher.ts', () => {
  describe('examCreateSchema', () => {
    it('accepts valid exam payload', () => {
      const valid = {
        title: 'Midterm Physics',
        instructions: 'No calculators allowed',
        duration_min: 60,
        open_at: '2026-11-01T10:00:00Z',
        close_at: '2026-11-01T12:00:00Z',
        negative_marking: 0.25,
        shuffle: true,
      };
      const result = examCreateSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects duration_min <= 0 or non-integer', () => {
      expect(examCreateSchema.safeParse({ title: 'Test', duration_min: 0 }).success).toBe(false);
      expect(examCreateSchema.safeParse({ title: 'Test', duration_min: -10 }).success).toBe(false);
      expect(examCreateSchema.safeParse({ title: 'Test', duration_min: 30.5 }).success).toBe(false);
    });

    it('rejects close_at before open_at', () => {
      const invalid = {
        title: 'Test',
        duration_min: 30,
        open_at: '2026-11-01T12:00:00Z',
        close_at: '2026-11-01T10:00:00Z',
      };
      const result = examCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('close_at must be greater than or equal to open_at');
      }
    });
  });

  describe('questionCreateSchema', () => {
    it('accepts valid question with options and matching correct_option', () => {
      const valid = {
        text: 'What is 3 * 3?',
        options: [
          { id: 'A', text: '6' },
          { id: 'B', text: '9' },
          { id: 'C', text: '12' },
        ],
        correct_option: 'B',
        marks: 2,
        topic: 'Math',
      };
      const result = questionCreateSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects question with less than 2 options', () => {
      const invalid = {
        text: 'Solo option question',
        options: [{ id: 'A', text: 'Only option' }],
        correct_option: 'A',
      };
      const result = questionCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects correct_option that is not in the options list', () => {
      const invalid = {
        text: 'Mismatched correct option',
        options: [
          { id: 'A', text: 'Option A' },
          { id: 'B', text: 'Option B' },
        ],
        correct_option: 'Z',
      };
      const result = questionCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('correct_option must match one of the option IDs');
      }
    });
  });

  describe('bulkParseSchema', () => {
    it('rejects empty input text', () => {
      expect(bulkParseSchema.safeParse({ text: '' }).success).toBe(false);
      expect(bulkParseSchema.safeParse({ text: 'Q: test\nA) 1\nB) 2 *' }).success).toBe(true);
    });
  });
});

