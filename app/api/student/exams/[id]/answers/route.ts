import { NextRequest } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { saveAnswerSchema } from '@/lib/validations/student';
import { handleZodError, jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/student/exams/[id]/answers
 * Saves a student's chosen option for a question in real-time.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON in request body', 400);
  }

  const parsed = saveAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  // 1. Fetch active attempt
  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select('id, deadline_at, status')
    .eq('exam_id', examId)
    .eq('student_id', auth.user.id)
    .single();

  if (attemptError || !attempt) {
    return jsonError('No attempt found for this exam', 404);
  }

  if (attempt.status !== 'in_progress') {
    return jsonError('Cannot save answer: attempt is already submitted', 400, {
      alreadySubmitted: true,
      status: attempt.status,
    });
  }

  // 2. Deadline check (allowing 10 seconds network latency grace period)
  const now = new Date();
  const deadline = new Date(attempt.deadline_at);
  const gracePeriodMs = 10000;

  if (now.getTime() > deadline.getTime() + gracePeriodMs) {
    return jsonSuccess({
      ok: false,
      expired: true,
      message: 'Time expired for this exam attempt.',
    });
  }

  // 3. Upsert answer in attempt_answers
  const cleanOption = parsed.data.chosen_option
    ? parsed.data.chosen_option.trim().toUpperCase()
    : null;

  const { data: answer, error: saveError } = await supabase
    .from('attempt_answers')
    .upsert(
      {
        attempt_id: attempt.id,
        question_id: parsed.data.question_id,
        chosen_option: cleanOption,
        updated_at: now.toISOString(),
      },
      { onConflict: 'attempt_id,question_id' }
    )
    .select('id, question_id, chosen_option')
    .single();

  if (saveError) {
    return jsonError(saveError.message, 500);
  }

  return jsonSuccess({
    ok: true,
    savedAnswer: answer,
    savedAt: now.toISOString(),
  });
}
