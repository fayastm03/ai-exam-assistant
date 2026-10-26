import { z } from 'zod';

export const saveAnswerSchema = z.object({
  question_id: z.string().uuid('Invalid question ID format'),
  chosen_option: z.string().trim().nullable().optional(),
});

export const submitExamSchema = z.object({
  autoSubmitted: z.boolean().optional().default(false),
});

export const joinClassSchema = z.object({
  code: z.string().trim().min(1, 'Join code is required').max(20, 'Join code too long'),
});


