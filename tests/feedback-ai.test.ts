import { describe, it, expect } from 'vitest';
import { loadPrompt } from '@/lib/ai/prompts';
import { suggestFeedbackResponseSchema } from '@/lib/validations/ai';
import { feedbackSaveSchema } from '@/lib/validations/teacher';

describe('Phase 5d: AI Feedback Suggestion & Draft Schema', () => {
  it('loads feedback.txt prompt and verifies placeholders and privacy constraints', () => {
    const prompt = loadPrompt('feedback', {
      score: '15 / 20',
      percentage: '75',
      topic_breakdown: '- Kinematics: 100%\n- Thermodynamics: 50%',
      wrong_questions: 'Question #3:\nText: What is entropy?\nStudent\'s Answer: B) Energy',
    });

    expect(prompt).toContain('academic tutor');
    expect(prompt).toContain('Total Score: 15 / 20');
    expect(prompt).toContain('Percentage: 75%');
    expect(prompt).toContain('Kinematics: 100%');
    expect(prompt).toContain('Question #3');
    expect(prompt).toContain('Do NOT use or invent student names, usernames, or emails');
    expect(prompt).not.toContain('{{score}}');
    expect(prompt).not.toContain('{{percentage}}');
  });

  it('validates a valid AI feedback response matching schema', () => {
    const valid = {
      feedback:
        'Great job on this exam! You performed exceptionally well in Kinematics. Review Thermodynamics concepts to master heat transfer. Keep up the great work!',
    };

    const parsed = suggestFeedbackResponseSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.feedback).toBe(valid.feedback);
    }
  });

  it('rejects feedback exceeding 1000 characters', () => {
    const tooLong = {
      feedback: 'a'.repeat(1001),
    };

    const parsed = suggestFeedbackResponseSchema.safeParse(tooLong);
    expect(parsed.success).toBe(false);
  });

  it('rejects empty feedback string', () => {
    const empty = {
      feedback: '   ',
    };

    const parsed = suggestFeedbackResponseSchema.safeParse(empty);
    expect(parsed.success).toBe(false);
  });

  it('validates feedbackSaveSchema with source ai_draft and manual', () => {
    const aiDraftSave = {
      overallComment: 'AI suggested feedback reviewed and saved by teacher.',
      released: false,
      source: 'ai_draft',
    };

    const parsed = feedbackSaveSchema.safeParse(aiDraftSave);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.source).toBe('ai_draft');
      expect(parsed.data.released).toBe(false);
    }

    const manualSave = {
      overallComment: 'Teacher custom feedback.',
      released: true,
      source: 'manual',
    };

    const parsedManual = feedbackSaveSchema.safeParse(manualSave);
    expect(parsedManual.success).toBe(true);
    if (parsedManual.success) {
      expect(parsedManual.data.source).toBe('manual');
      expect(parsedManual.data.released).toBe(true);
    }
  });
});

