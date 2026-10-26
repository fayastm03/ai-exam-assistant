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

