import { z } from 'zod';

/**
 * Standard option format: array of { id: string, text: string }
 */
export const optionItemSchema = z.object({
  id: z.string().trim().min(1, 'Option id is required'),
  text: z.string().trim().min(1, 'Option text is required').max(2000, 'Option text cannot exceed 2,000 characters'),
});

export const examCreateSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title too long'),
    instructions: z.string().trim().optional().nullable(),
    duration_min: z
      .number({ message: 'duration_min must be a number' })
      .int('Duration must be a whole number of minutes')
      .positive('Duration must be greater than 0 minutes'),
    open_at: z.string().datetime({ message: 'open_at must be a valid ISO timestamp' }).optional().nullable(),
    close_at: z.string().datetime({ message: 'close_at must be a valid ISO timestamp' }).optional().nullable(),
    negative_marking: z
      .number({ message: 'negative_marking must be a number' })
      .min(0, 'Negative marking fraction cannot be negative')
      .default(0),
    shuffle: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.open_at && data.close_at) {
        return new Date(data.close_at) >= new Date(data.open_at);
      }
      return true;
    },
    {
      message: 'close_at must be greater than or equal to open_at',
      path: ['close_at'],
    }
  );

export const examUpdateSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title too long').optional(),
    instructions: z.string().trim().optional().nullable(),
    duration_min: z
      .number({ message: 'duration_min must be a number' })
      .int('Duration must be a whole number of minutes')
      .positive('Duration must be greater than 0 minutes')
      .optional(),
    open_at: z.string().datetime({ message: 'open_at must be a valid ISO timestamp' }).optional().nullable(),
    close_at: z.string().datetime({ message: 'close_at must be a valid ISO timestamp' }).optional().nullable(),
    negative_marking: z
      .number({ message: 'negative_marking must be a number' })
      .min(0, 'Negative marking fraction cannot be negative')
      .optional(),
    shuffle: z.boolean().optional(),
    status: z.enum(['draft', 'closed'], {
      message: "Status can only be updated to 'draft' or 'closed' via this route. Use the publish endpoint to publish.",
    }).optional(),
  })
  .refine(
    (data) => {
      if (data.open_at && data.close_at) {
        return new Date(data.close_at) >= new Date(data.open_at);
      }
      return true;
    },
    {
      message: 'close_at must be greater than or equal to open_at',
      path: ['close_at'],
    }
  );

export const questionCreateSchema = z
  .object({
    number: z.number().int().positive().optional(),
    text: z.string().trim().min(1, 'Question text is required').max(10000, 'Question text cannot exceed 10,000 characters'),
    options: z.union([
      z.array(optionItemSchema).min(2, 'Must provide at least 2 options'),
      z.record(z.string(), z.string()).refine(
        (rec) => Object.keys(rec).length >= 2,
        'Must provide at least 2 options'
      ),
    ]),
    correct_option: z.string().trim().min(1, 'Correct option is required'),
    marks: z
      .number({ message: 'marks must be a number' })
      .positive('Marks must be greater than 0')
      .default(1),
    topic: z.string().trim().max(255, 'Topic cannot exceed 255 characters').optional().nullable(),
    explanation: z.string().trim().max(10000, 'Explanation cannot exceed 10,000 characters').optional().nullable(),
    source: z.enum(['manual', 'imported', 'generated']).default('manual'),
    review_status: z.enum(['draft', 'approved']).default('approved'),
  })
  .refine(
    (data) => {
      // Validate that correct_option matches one of the option IDs
      if (Array.isArray(data.options)) {
        return data.options.some(
          (opt) => opt.id.trim().toUpperCase() === data.correct_option.trim().toUpperCase()
        );
      } else {
        const keys = Object.keys(data.options).map((k) => k.trim().toUpperCase());
        return keys.includes(data.correct_option.trim().toUpperCase());
      }
    },
    {
      message: 'correct_option must match one of the option IDs',
      path: ['correct_option'],
    }
  );

export const questionUpdateSchema = z.object({
  number: z.number().int().positive().optional(),
  text: z.string().trim().min(1, 'Question text cannot be empty').max(10000, 'Question text cannot exceed 10,000 characters').optional(),
  options: z
    .union([
      z.array(optionItemSchema).min(2, 'Must provide at least 2 options'),
      z.record(z.string(), z.string()).refine(
        (rec) => Object.keys(rec).length >= 2,
        'Must provide at least 2 options'
      ),
    ])
    .optional(),
  correct_option: z.string().trim().min(1, 'Correct option cannot be empty').optional(),
  marks: z
    .number({ message: 'marks must be a number' })
    .positive('Marks must be greater than 0')
    .optional(),
  topic: z.string().trim().max(255, 'Topic cannot exceed 255 characters').optional().nullable(),
  explanation: z.string().trim().max(10000, 'Explanation cannot exceed 10,000 characters').optional().nullable(),
  source: z.enum(['manual', 'imported', 'generated']).optional(),
  review_status: z.enum(['draft', 'approved']).optional(),
});

export const bulkParseSchema = z.object({
  text: z.string().min(1, 'Input text cannot be empty').max(100000, 'Bulk text cannot exceed 100,000 characters'),
});

export const feedbackSaveSchema = z.object({
  overallComment: z
    .string()
    .trim()
    .max(1000, 'Overall comment must be 1000 characters or fewer')
    .optional()
    .nullable(),
  questionComments: z
    .array(
      z.object({
        questionId: z.string().uuid('Invalid question ID'),
        comment: z.string().trim().max(1000, 'Question comment must be 1000 characters or fewer'),
      })
    )
    .optional()
    .default([]),
  released: z.boolean().default(false),
  source: z.enum(['manual', 'ai_draft']).default('manual'),
});


