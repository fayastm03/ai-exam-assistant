import { z } from 'zod';

export const extractedOptionSchema = z.object({
  id: z.string().trim().min(1, 'Option id is required'),
  text: z.string().trim().min(1, 'Option text is required'),
});

export const extractedQuestionSchema = z.object({
  number: z.number().int().positive().optional().default(1),
  text: z.string().trim().min(1, 'Question text cannot be empty'),
  options: z.array(extractedOptionSchema).min(2, 'Must have at least 2 options'),
  correct_option: z.string().trim().optional().nullable().default(''),
  marks: z.number().positive().optional().default(1),
  topic: z.string().trim().optional().nullable().default(null),
  explanation: z.string().trim().optional().nullable().default(null),
});

export const extractedQuestionsResponseSchema = z.object({
  questions: z.array(extractedQuestionSchema),
});

export type ExtractedQuestion = z.infer<typeof extractedQuestionSchema>;
export type ExtractedQuestionsResponse = z.infer<typeof extractedQuestionsResponseSchema>;

// --- Explain Prompt Schemas ---

export const explainQuestionItemSchema = z.object({
  number: z.number().int().positive(),
  explanation: z.string().trim().min(1, 'Explanation cannot be empty'),
  flag: z.boolean().default(false),
  flag_reason: z.string().trim().optional().nullable().default(null),
});

export const explainQuestionsResponseSchema = z.object({
  questions: z.array(explainQuestionItemSchema),
});

export type ExplainQuestionItem = z.infer<typeof explainQuestionItemSchema>;
export type ExplainQuestionsResponse = z.infer<typeof explainQuestionsResponseSchema>;

// --- Generate Prompt Schemas ---

export const generatedOptionSchema = z.object({
  id: z.string().trim().min(1, 'Option id is required'),
  text: z.string().trim().min(1, 'Option text is required'),
});

export const generatedQuestionItemSchema = z.object({
  text: z.string().trim().min(3, 'Question text is too short'),
  options: z.array(generatedOptionSchema).min(2, 'Must have at least 2 options'),
  correct_option: z.string().trim().min(1, 'Correct option is required'),
  marks: z.number().positive().optional().default(1),
  topic: z.string().trim().optional().nullable().default(null),
  explanation: z.string().trim().optional().nullable().default(null),
});

export const generatedQuestionsResponseSchema = z.object({
  questions: z.array(generatedQuestionItemSchema),
});

export type GeneratedQuestionItem = z.infer<typeof generatedQuestionItemSchema>;
export type GeneratedQuestionsResponse = z.infer<typeof generatedQuestionsResponseSchema>;

// --- Generate Input Validation ---

export const generateFromNotesInputSchema = z.object({
  count: z.coerce.number().int().min(1, 'Count must be at least 1').max(20, 'Count cannot exceed 20').default(5),
  level: z.enum(['easy', 'medium', 'hard']).default('medium'),
  text: z.string().max(50000, 'Text exceeds 50,000 character limit').optional().default(''),
});

// --- Feedback Suggestion Validation ---

export const suggestFeedbackResponseSchema = z.object({
  feedback: z
    .string()
    .trim()
    .min(1, 'Feedback cannot be empty')
    .max(1000, 'Feedback must be 1000 characters or fewer'),
});

export type SuggestFeedbackResponse = z.infer<typeof suggestFeedbackResponseSchema>;

// --- Student Automated Feedback Validation ---

export function trimFeedbackAtSentenceEnd(text: string, maxLength: number = 1000): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const chunk = trimmed.slice(0, maxLength);
  const lastDot = chunk.lastIndexOf('.');
  const lastExcl = chunk.lastIndexOf('!');
  const lastQ = chunk.lastIndexOf('?');
  const lastPunct = Math.max(lastDot, lastExcl, lastQ);
  if (lastPunct > 50) {
    return chunk.slice(0, lastPunct + 1).trim();
  }
  return chunk.trim();
}

export const studentFeedbackResponseSchema = z.object({
  feedback: z
    .string()
    .trim()
    .min(1, 'Feedback cannot be empty')
    .transform((val) => trimFeedbackAtSentenceEnd(val, 1000)),
});

export type StudentFeedbackResponse = z.infer<typeof studentFeedbackResponseSchema>;
