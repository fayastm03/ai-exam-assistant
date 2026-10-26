import { describe, it, expect } from 'vitest';
import { parseBulkQuestions } from '@/lib/bulk-parser';

describe('lib/bulk-parser.ts', () => {
  it('parses questions with standard format including correct option asterisk, topic, and marks', () => {
    const input = `
Q: What is the capital of France?
A) London
B) Paris *
C) Berlin
D) Madrid
Topic: Geography
Marks: 2
Explanation: Paris has been the capital since 508.

Q: Which element has the chemical symbol O?
A) Gold
B) Oxygen *
C) Osmium
Topic: Science
`;

    const result = parseBulkQuestions(input);

    expect(result.totalParsed).toBe(2);
    expect(result.validCount).toBe(2);
    expect(result.hasErrors).toBe(false);

    const q1 = result.questions[0];
    expect(q1.number).toBe(1);
    expect(q1.text).toBe('What is the capital of France?');
    expect(q1.options).toEqual([
      { id: 'A', text: 'London' },
      { id: 'B', text: 'Paris' },
      { id: 'C', text: 'Berlin' },
      { id: 'D', text: 'Madrid' },
    ]);
    expect(q1.correct_option).toBe('B');
    expect(q1.marks).toBe(2);
    expect(q1.topic).toBe('Geography');
    expect(q1.explanation).toBe('Paris has been the capital since 508.');
    expect(q1.isValid).toBe(true);

    const q2 = result.questions[1];
    expect(q2.number).toBe(2);
    expect(q2.text).toBe('Which element has the chemical symbol O?');
    expect(q2.correct_option).toBe('B');
    expect(q2.marks).toBe(1); // default marks
    expect(q2.topic).toBe('Science');
    expect(q2.explanation).toBeNull();
  });

  it('flags errors when no asterisk is provided or when less than 2 options exist', () => {
    const input = `
Q: Question without correct answer marked
A) One
B) Two
C) Three

Q: Question with only one option
A) Lonely option *
`;

    const result = parseBulkQuestions(input);

    expect(result.totalParsed).toBe(2);
    expect(result.validCount).toBe(0);
    expect(result.hasErrors).toBe(true);

    expect(result.questions[0].isValid).toBe(false);
    expect(result.questions[0].errors).toContain('No correct option marked with asterisk (*)');

    expect(result.questions[1].isValid).toBe(false);
    expect(result.questions[1].errors.some((e) => e.includes('At least 2 options'))).toBe(true);
  });
});

