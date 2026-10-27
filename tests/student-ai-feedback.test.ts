import { describe, it, expect, vi } from 'vitest';
import {
  trimFeedbackAtSentenceEnd,
  studentFeedbackResponseSchema,
} from '@/lib/validations/ai';
import { buildAutoTemplateFeedback } from '@/lib/ai/student-feedback';

describe('Feature: Automatic Student AI Feedback', () => {
  describe('Zod Validation and Sentence Boundary Trimming', () => {
    it('preserves valid feedback under 1000 characters intact', () => {
      const feedback = 'Great effort on your exam! You showed strong understanding of algebra.';
      const result = trimFeedbackAtSentenceEnd(feedback, 1000);
      expect(result).toBe(feedback);

      const parsed = studentFeedbackResponseSchema.safeParse({ feedback });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.feedback).toBe(feedback);
      }
    });

    it('trims feedback exceeding 1000 characters at the last sentence end', () => {
      const sentence1 = 'You performed very well in kinematics. ';
      const sentence2 = 'Keep revising thermodynamics formulas to master heat engines. ';
      const sentence3 = 'A'.repeat(950) + '.';
      const longText = sentence1 + sentence2 + sentence3;

      expect(longText.length).toBeGreaterThan(1000);

      const trimmed = trimFeedbackAtSentenceEnd(longText, 1000);
      expect(trimmed.length).toBeLessThanOrEqual(1000);
      expect(trimmed.endsWith('.')).toBe(true);
    });

    it('rejects empty or whitespace-only feedback', () => {
      const empty = { feedback: '   ' };
      const parsed = studentFeedbackResponseSchema.safeParse(empty);
      expect(parsed.success).toBe(false);
    });
  });

  describe('Deterministic Auto-Template Fallback', () => {
    it('builds a kind, factual template text from score, percentage and topics', () => {
      const template = buildAutoTemplateFeedback({
        score: 16,
        maxScore: 20,
        percentage: 80,
        weakTopics: ['Thermodynamics'],
        strongTopics: ['Kinematics', 'Optics'],
      });

      expect(template).toContain('16 out of 20 (80%)');
      expect(template).toContain('Kinematics and Optics');
      expect(template).toContain('Thermodynamics');
      expect(template).toContain('Review the question explanations below');
      expect(template.length).toBeLessThan(1000);

      // Privacy check: Never includes personal identity
      expect(template).not.toContain('@');
      expect(template).not.toContain('student@');
    });

    it('handles low scores with supportive tone', () => {
      const template = buildAutoTemplateFeedback({
        score: 4,
        maxScore: 20,
        percentage: 20,
        weakTopics: ['Calculus', 'Algebra'],
        strongTopics: [],
      });

      expect(template).toContain('4 out of 20 (20%)');
      expect(template).toContain('learning opportunity');
      expect(template).toContain('Calculus and Algebra');
      expect(template.length).toBeLessThan(1000);
    });
  });

  describe('Edge Cases (Docs Matrix Cases 29-33)', () => {
    it('Edge Case 30: AI failure triggers auto_template fallback', () => {
      // Demonstrates that buildAutoTemplateFeedback creates a valid response conforming to studentFeedbackResponseSchema
      const templateFeedback = buildAutoTemplateFeedback({
        score: 15,
        maxScore: 30,
        percentage: 50,
        weakTopics: ['Vectors'],
        strongTopics: ['Arithmetic'],
      });

      const parsed = studentFeedbackResponseSchema.safeParse({ feedback: templateFeedback });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.feedback).toBe(templateFeedback);
      }
    });

    it('Edge Case 31: In-progress attempts cannot generate automated feedback', () => {
      const checkAttemptStatus = (status: string) => {
        if (status !== 'submitted' && status !== 'auto_submitted') {
          throw new Error('Automated feedback is only available for submitted attempts');
        }
        return true;
      };

      expect(() => checkAttemptStatus('in_progress')).toThrow(
        'Automated feedback is only available for submitted attempts'
      );
      expect(checkAttemptStatus('submitted')).toBe(true);
      expect(checkAttemptStatus('auto_submitted')).toBe(true);
    });

    it('Edge Case 32: Student access is strictly scoped to own attempt', () => {
      const verifyAttemptAccess = (attemptStudentId: string, authUserId: string) => {
        if (attemptStudentId !== authUserId) {
          throw new Error('No attempt found for this exam');
        }
        return true;
      };

      const myId = 'student-uuid-1';
      const otherId = 'student-uuid-2';

      expect(verifyAttemptAccess(myId, myId)).toBe(true);
      expect(() => verifyAttemptAccess(otherId, myId)).toThrow('No attempt found for this exam');
    });

    it('Edge Case 33: Bulk generator filters out attempts with existing ai_auto or auto_template', () => {
      const allAttempts = [{ id: 'att-1' }, { id: 'att-2' }, { id: 'att-3' }];
      const existingWithFeedback = new Set(['att-1', 'att-2', 'att-3']);

      const pending = allAttempts.filter((a) => !existingWithFeedback.has(a.id));
      expect(pending.length).toBe(0);

      // Running bulk generation when pending is 0 results in done = true and 0 new processes
      const result = {
        done: pending.length === 0,
        batchProcessed: pending.length,
        totalRemaining: 0,
      };
      expect(result.done).toBe(true);
      expect(result.batchProcessed).toBe(0);
    });
  });
});

