import { describe, it, expect } from 'vitest';
import {
  calculateScore,
  isAnswerCorrect,
  getAnswerStatus,
  type QuestionForScoring,
} from '@/lib/scoring';

describe('lib/scoring.ts', () => {
  describe('Helper Functions', () => {
    it('isAnswerCorrect compares options case-insensitively and trims whitespace', () => {
      expect(isAnswerCorrect('A', 'A')).toBe(true);
      expect(isAnswerCorrect('a', 'A')).toBe(true);
      expect(isAnswerCorrect('  b  ', 'B')).toBe(true);
      expect(isAnswerCorrect('A', 'B')).toBe(false);
      expect(isAnswerCorrect(null, 'A')).toBe(false);
      expect(isAnswerCorrect('', 'A')).toBe(false);
    });

    it('getAnswerStatus distinguishes correct, wrong, and skipped', () => {
      expect(getAnswerStatus('A', 'A')).toBe('correct');
      expect(getAnswerStatus('B', 'A')).toBe('wrong');
      expect(getAnswerStatus(null, 'A')).toBe('skipped');
      expect(getAnswerStatus(undefined, 'A')).toBe('skipped');
      expect(getAnswerStatus('   ', 'A')).toBe('skipped');
    });
  });

  describe('1. All Correct', () => {
    it('awards full marks for every question and reports 100% score with no weak topics', () => {
      const questions: QuestionForScoring[] = [
        { id: 'q1', marks: 2, correct_option: 'A', topic: 'Math' },
        { id: 'q2', marks: 3, correct_option: 'B', topic: 'Science' },
        { id: 'q3', marks: 5, correct_option: 'C', topic: 'Math' },
      ];

      const answers = {
        q1: 'A',
        q2: 'B',
        q3: 'C',
      };

      const result = calculateScore(questions, answers, 0.25);

      expect(result.totalScore).toBe(10);
      expect(result.rawScore).toBe(10);
      expect(result.maxPossibleScore).toBe(10);
      expect(result.percentage).toBe(100);
      expect(result.correctCount).toBe(3);
      expect(result.wrongCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.weakTopics).toEqual([]);
      expect(result.topicPercentages['Math']).toBe(100);
      expect(result.topicPercentages['Science']).toBe(100);
    });
  });

  describe('2. All Wrong', () => {
    it('earns 0 when negative marking is 0', () => {
      const questions: QuestionForScoring[] = [
        { id: 'q1', marks: 4, correct_option: 'A', topic: 'History' },
        { id: 'q2', marks: 4, correct_option: 'B', topic: 'History' },
      ];

      const answers = {
        q1: 'C',
        q2: 'D',
      };

      const result = calculateScore(questions, answers, 0);

      expect(result.totalScore).toBe(0);
      expect(result.rawScore).toBe(0);
      expect(result.correctCount).toBe(0);
      expect(result.wrongCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.weakTopics).toEqual(['History']);
    });

    it('clamps total score to 0 when negative marking makes rawScore negative', () => {
      const questions: QuestionForScoring[] = [
        { id: 'q1', marks: 4, correct_option: 'A' },
        { id: 'q2', marks: 4, correct_option: 'B' },
      ];

      const answers = {
        q1: 'C', // -1
        q2: 'D', // -1
      };

      const result = calculateScore(questions, answers, 0.25);

      expect(result.rawScore).toBe(-2);
      expect(result.totalScore).toBe(0); // Never below 0 by default
      expect(result.wrongCount).toBe(2);
    });

    it('allows negative total score when explicitly requested via options', () => {
      const questions: QuestionForScoring[] = [
        { id: 'q1', marks: 4, correct_option: 'A' },
        { id: 'q2', marks: 4, correct_option: 'B' },
      ];

      const answers = {
        q1: 'C', // -1
        q2: 'D', // -1
      };

      const result = calculateScore(questions, answers, 0.25, {
        allowNegativeTotal: true,
      });

      expect(result.rawScore).toBe(-2);
      expect(result.totalScore).toBe(-2);
    });
  });

  describe('3. Skipped Questions', () => {
    it('awards 0 points for skipped questions without applying negative penalty', () => {
      const questions: QuestionForScoring[] = [
        { id: 'q1', marks: 5, correct_option: 'A', topic: 'Physics' },
        { id: 'q2', marks: 5, correct_option: 'B', topic: 'Physics' },
        { id: 'q3', marks: 5, correct_option: 'C', topic: 'Chemistry' },
      ];

      // q1 correct, q2 skipped (missing from map), q3 skipped (null)
      const answers = {
        q1: 'A',
        q3: null,
      };

      const result = calculateScore(questions, answers, 0.5);

      expect(result.totalScore).toBe(5);
      expect(result.correctCount).toBe(1);
      expect(result.skippedCount).toBe(2);
      expect(result.wrongCount).toBe(0);
      expect(result.questionResults.find((r) => r.questionId === 'q2')?.status).toBe('skipped');
      expect(result.questionResults.find((r) => r.questionId === 'q3')?.status).toBe('skipped');
    });

    it('handles all skipped questions correctly', () => {
      const questions: QuestionForScoring[] = [
        { id: 'q1', marks: 2, correct_option: 'A' },
        { id: 'q2', marks: 3, correct_option: 'B' },
      ];

      const result = calculateScore(questions, {});

      expect(result.totalScore).toBe(0);
      expect(result.correctCount).toBe(0);
      expect(result.wrongCount).toBe(0);
      expect(result.skippedCount).toBe(2);
      expect(result.percentage).toBe(0);
    });
  });

  describe('4. Negative Marking', () => {
    it('deducts negative marking amount as a fraction of the question marks', () => {
      const questions: QuestionForScoring[] = [
        // 4 marks, 25% negative marking -> 1 mark deduction for wrong
        { id: 'q1', marks: 4, correct_option: 'A' },
        { id: 'q2', marks: 4, correct_option: 'B' },
        { id: 'q3', marks: 4, correct_option: 'C' },
        { id: 'q4', marks: 4, correct_option: 'D' },
      ];

      const answers = [
        { question_id: 'q1', chosen_option: 'A' }, // Correct: +4
        { question_id: 'q2', chosen_option: 'B' }, // Correct: +4
        { question_id: 'q3', chosen_option: 'A' }, // Wrong: -1 (4 * 0.25)
        { question_id: 'q4', chosen_option: null }, // Skipped: 0
      ];

      const result = calculateScore(questions, answers, 0.25);

      // Expected total: 4 + 4 - 1 + 0 = 7
      expect(result.totalScore).toBe(7);
      expect(result.maxPossibleScore).toBe(16);
      expect(result.percentage).toBe(43.75); // (7 / 16) * 100
      expect(result.correctCount).toBe(2);
      expect(result.wrongCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });

    it('handles 1/3 (0.3333...) negative marking fraction accurately without precision artifacts', () => {
      const questions: QuestionForScoring[] = [
        { id: 'q1', marks: 3, correct_option: 'A' }, // Wrong -> -1
        { id: 'q2', marks: 3, correct_option: 'B' }, // Correct -> +3
      ];

      const answers = {
        q1: 'X',
        q2: 'B',
      };

      const result = calculateScore(questions, answers, 1 / 3);

      expect(result.totalScore).toBe(2);
      expect(result.rawScore).toBe(2);
    });
  });

  describe('5. Mixed Marks', () => {
    it('properly weights questions with different mark values', () => {
      const questions: QuestionForScoring[] = [
        { id: 'q1', marks: 1, correct_option: 'A', topic: 'Quick' },
        { id: 'q2', marks: 2, correct_option: 'B', topic: 'Medium' },
        { id: 'q3', marks: 5, correct_option: 'C', topic: 'Hard' },
        { id: 'q4', marks: 10, correct_option: 'D', topic: 'Hard' },
      ];

      // Correct on Q1 (1) & Q4 (10) = 11
      // Wrong on Q2 (2 * 0.5 = -1)
      // Skipped Q3 (0)
      const answers = {
        q1: 'A',
        q2: 'Wrong',
        q3: undefined,
        q4: 'D',
      };

      const result = calculateScore(questions, answers, 0.5);

      expect(result.maxPossibleScore).toBe(18); // 1 + 2 + 5 + 10
      expect(result.totalScore).toBe(10); // 1 - 1 + 0 + 10 = 10
      expect(result.percentage).toBe(55.56); // 10 / 18 = 55.555... -> 55.56
      expect(result.correctCount).toBe(2);
      expect(result.wrongCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });
  });

  describe('6. Empty Attempt', () => {
    it('returns zeroes safely when questions list is empty', () => {
      const result = calculateScore([], {});

      expect(result.totalScore).toBe(0);
      expect(result.rawScore).toBe(0);
      expect(result.maxPossibleScore).toBe(0);
      expect(result.percentage).toBe(0);
      expect(result.totalQuestions).toBe(0);
      expect(result.correctCount).toBe(0);
      expect(result.wrongCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.questionResults).toEqual([]);
      expect(result.topics).toEqual({});
      expect(result.weakTopics).toEqual([]);
    });

    it('returns 0 score and all skipped when questions exist but answers object is empty', () => {
      const questions: QuestionForScoring[] = [
        { id: 'q1', marks: 5, correct_option: 'A', topic: 'Math' },
      ];

      const result = calculateScore(questions, []);

      expect(result.totalScore).toBe(0);
      expect(result.maxPossibleScore).toBe(5);
      expect(result.skippedCount).toBe(1);
      expect(result.percentage).toBe(0);
      expect(result.weakTopics).toEqual(['Math']);
    });
  });

  describe('7. Topic Breakdown & Weak Topics', () => {
    it('computes per-topic percentages and identifies topics under 50% as weak', () => {
      const questions: QuestionForScoring[] = [
        // Algebra: 2 questions, 10 marks total. Student gets 8 marks -> 80% (strong)
        { id: 'q1', marks: 5, correct_option: 'A', topic: 'Algebra' },
        { id: 'q2', marks: 5, correct_option: 'B', topic: 'Algebra' },

        // Geometry: 2 questions, 10 marks total. Student gets 1 correct (5 marks) -> 50% (strong >= 50%)
        { id: 'q3', marks: 5, correct_option: 'C', topic: 'Geometry' },
        { id: 'q4', marks: 5, correct_option: 'D', topic: 'Geometry' },

        // Calculus: 2 questions, 10 marks total. Student gets 0 correct, 1 wrong (-1) -> 0% (weak < 50%)
        { id: 'q5', marks: 5, correct_option: 'A', topic: 'Calculus' },
        { id: 'q6', marks: 5, correct_option: 'B', topic: 'Calculus' },

        // Physics: 1 question, 4 marks total. Student gets 1 wrong (-1) -> 0% (weak < 50%)
        { id: 'q7', marks: 4, correct_option: 'A', topic: 'Physics' },
      ];

      // Let's configure answers specifically so:
      // Algebra: q1 correct (+5), q2 correct (+5) -> 10/10 = 100%
      // Geometry: q3 correct (+5), q4 skipped (0) -> 5/10 = 50%
      // Calculus: q5 wrong (-1), q6 skipped (0) -> 0/10 = 0% (<50%, weak)
      // Physics: q7 wrong (-0.8) -> 0% (<50%, weak)
      const testAnswers = {
        q1: 'A', // +5
        q2: 'B', // +5 -> Algebra: 10/10 = 100%
        q3: 'C', // +5
        q4: null, // 0 -> Geometry: 5/10 = 50%
        q5: 'X', // -1
        q6: null, // 0 -> Calculus: 0%
        q7: 'X', // -0.8 -> Physics: 0%
      };

      const result = calculateScore(questions, testAnswers, 0.2);

      expect(result.topicPercentages['Algebra']).toBe(100);
      expect(result.topicPercentages['Geometry']).toBe(50);
      expect(result.topicPercentages['Calculus']).toBe(0);
      expect(result.topicPercentages['Physics']).toBe(0);

      // Topics under 50% must be flagged as weak
      expect(result.weakTopics).toEqual(['Calculus', 'Physics']);
      expect(result.weakTopics).not.toContain('Algebra');
      expect(result.weakTopics).not.toContain('Geometry');

      // Verify detailed topic breakdown object
      const algebra = result.topics['Algebra'];
      expect(algebra.totalMarks).toBe(10);
      expect(algebra.earnedMarks).toBe(10);
      expect(algebra.correctCount).toBe(2);
      expect(algebra.wrongCount).toBe(0);
      expect(algebra.skippedCount).toBe(0);

      const geometry = result.topics['Geometry'];
      expect(geometry.totalMarks).toBe(10);
      expect(geometry.earnedMarks).toBe(5);
      expect(geometry.correctCount).toBe(1);
      expect(geometry.wrongCount).toBe(0);
      expect(geometry.skippedCount).toBe(1);
    });

    it('defaults questions with missing or whitespace topic to "General"', () => {
      const questions: QuestionForScoring[] = [
        { id: 'q1', marks: 2, correct_option: 'A', topic: null },
        { id: 'q2', marks: 3, correct_option: 'B', topic: '   ' },
      ];

      const answers = { q1: 'A', q2: 'B' };
      const result = calculateScore(questions, answers);

      expect(result.topics['General']).toBeDefined();
      expect(result.topics['General'].totalMarks).toBe(5);
      expect(result.topics['General'].earnedMarks).toBe(5);
      expect(result.topicPercentages['General']).toBe(100);
    });
  });
});
