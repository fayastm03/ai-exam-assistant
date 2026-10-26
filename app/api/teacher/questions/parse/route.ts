import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { bulkParseSchema } from '@/lib/validations/teacher';
import { handleZodError, jsonError, jsonSuccess } from '@/lib/api-response';
import { parseBulkQuestions } from '@/lib/bulk-parser';

/**
 * POST /api/teacher/questions/parse
 * Bulk-paste question parser.
 * Format expected:
 *   Q: Question text
 *   A) Option A
 *   B) Option B * (asterisk marks correct option)
 *   Topic: Topic name (optional)
 *   Marks: Number (optional, defaults to 1)
 *   Explanation: Text (optional)
 *
 * Returns parsed draft questions WITHOUT saving them to the database.
 */
export async function POST(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON in request body', 400);
  }

  const parsed = bulkParseSchema.safeParse(body);
  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  const result = parseBulkQuestions(parsed.data.text);

  return jsonSuccess({
    questions: result.questions,
    totalParsed: result.totalParsed,
    validCount: result.validCount,
    hasErrors: result.hasErrors,
  });
}

