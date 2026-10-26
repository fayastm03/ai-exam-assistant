/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { checkAndAutoSubmitIfExpired } from '@/lib/attempt-autosubmit';
import { bulkParseSchema, questionCreateSchema } from '@/lib/validations/teacher';
import { saveAnswerSchema, submitExamSchema } from '@/lib/validations/student';

describe('Phase 6: App Hardening & Edge Cases', () => {
  describe('Edge Case 1: Double Submit & Submit Validation', () => {
    it('accepts both manual and autoSubmitted payloads without failing schema', () => {
      const manual = submitExamSchema.safeParse({ autoSubmitted: false });
      expect(manual.success).toBe(true);

      const auto = submitExamSchema.safeParse({ autoSubmitted: true });
      expect(auto.success).toBe(true);

      const empty = submitExamSchema.safeParse({});
      expect(empty.success).toBe(true);
      if (empty.success) {
        expect(empty.data.autoSubmitted).toBe(false);
      }
    });
  });

  describe('Edge Case 2 & 4: Deadline Expiration & Auto-Submit on Next Read', () => {
    it('auto-submits an in-progress attempt if the deadline has passed', async () => {
      const mockQuestions = [
        { id: 'q1', marks: 2, correct_option: 'A', topic: 'Physics' },
        { id: 'q2', marks: 3, correct_option: 'B', topic: 'Physics' },
      ];

      const mockSavedAnswers = [
        { id: 'a1', question_id: 'q1', chosen_option: 'A' }, // correct (+2)
        { id: 'a2', question_id: 'q2', chosen_option: 'C' }, // wrong (0)
      ];

      const pastDeadline = new Date(Date.now() - 60000).toISOString(); // 1 minute ago

      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });
      const upsertMock = vi.fn().mockResolvedValue({});

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'questions') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockQuestions, error: null }),
              }),
            };
          }
          if (table === 'attempt_answers') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockSavedAnswers, error: null }),
              }),
              upsert: upsertMock,
            };
          }
          if (table === 'attempts') {
            return {
              update: updateMock,
            };
          }
          return {};
        }),
      } as any;

      const attempt = {
        id: 'att-123',
        exam_id: 'exam-123',
        student_id: 'stu-123',
        status: 'in_progress',
        deadline_at: pastDeadline,
      };

      const exam = {
        id: 'exam-123',
        negative_marking: 0,
      };

      const result = await checkAndAutoSubmitIfExpired(mockSupabase, attempt, exam);

      expect(result.wasAutoSubmitted).toBe(true);
      expect(result.score).toBe(2); // 2 out of 5 marks earned

      // Verifies attempt status updated to auto_submitted
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'auto_submitted',
          score: 2,
        })
      );
    });

    it('does not auto-submit if the deadline has not passed yet', async () => {
      const futureDeadline = new Date(Date.now() + 600000).toISOString(); // 10 minutes in future

      const mockSupabase = {
        from: vi.fn(),
      } as any;

      const attempt = {
        id: 'att-future',
        exam_id: 'exam-future',
        student_id: 'stu-future',
        status: 'in_progress',
        deadline_at: futureDeadline,
      };

      const exam = {
        id: 'exam-future',
        negative_marking: 0,
      };

      const result = await checkAndAutoSubmitIfExpired(mockSupabase, attempt, exam);
      expect(result.wasAutoSubmitted).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('does not re-submit an already submitted attempt', async () => {
      const mockSupabase = { from: vi.fn() } as any;

      const attempt = {
        id: 'att-done',
        exam_id: 'exam-done',
        student_id: 'stu-done',
        status: 'submitted',
        deadline_at: new Date(Date.now() - 50000).toISOString(),
      };

      const exam = { id: 'exam-done', negative_marking: 0 };
      const result = await checkAndAutoSubmitIfExpired(mockSupabase, attempt, exam);
      expect(result.wasAutoSubmitted).toBe(false);
    });
  });

  describe('Edge Case 3: Answer After Deadline / Validation', () => {
    it('validates answer input schema', () => {
      const valid = saveAnswerSchema.safeParse({
        question_id: '123e4567-e89b-12d3-a456-426614174000',
        chosen_option: 'A',
      });
      expect(valid.success).toBe(true);

      const clearAnswer = saveAnswerSchema.safeParse({
        question_id: '123e4567-e89b-12d3-a456-426614174000',
        chosen_option: null,
      });
      expect(clearAnswer.success).toBe(true);
    });
  });

  describe('Edge Case 8: Oversized Uploads and Long Text Limits', () => {
    it('rejects questions with text exceeding 10,000 characters', () => {
      const tooLongQuestion = {
        text: 'A'.repeat(10001),
        options: [
          { id: 'A', text: 'Option A' },
          { id: 'B', text: 'Option B' },
        ],
        correct_option: 'A',
      };

      const parsed = questionCreateSchema.safeParse(tooLongQuestion);
      expect(parsed.success).toBe(false);
    });

    it('rejects options with text exceeding 2,000 characters', () => {
      const tooLongOption = {
        text: 'Question text',
        options: [
          { id: 'A', text: 'B'.repeat(2001) },
          { id: 'B', text: 'Valid option' },
        ],
        correct_option: 'B',
      };

      const parsed = questionCreateSchema.safeParse(tooLongOption);
      expect(parsed.success).toBe(false);
    });

    it('rejects bulk text exceeding 100,000 characters', () => {
      const hugeBulkText = {
        text: 'Q: test\nA) 1 *\nB) 2\n'.repeat(6000), // 120,000 chars > 100,000
      };

      const parsed = bulkParseSchema.safeParse(hugeBulkText);
      expect(parsed.success).toBe(false);
    });
  });
});
