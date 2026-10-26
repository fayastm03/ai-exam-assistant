import { NextRequest } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/student/exams/[id]/start
 * Starts a new exam attempt or returns the ongoing attempt.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  // 1. Fetch published exam
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, title, duration_min, status, open_at, close_at')
    .eq('id', examId)
    .eq('status', 'published')
    .single();

  if (examError || !exam) {
    return jsonError('Exam is not available or not published', 404);
  }

  const now = new Date();

  // Check schedule window if defined
  if (exam.open_at && new Date(exam.open_at) > now) {
    return jsonError('This exam is not open yet', 400);
  }
  if (exam.close_at && new Date(exam.close_at) < now) {
    return jsonError('This exam is closed', 400);
  }

  // 2. Check for existing attempt
  const { data: existingAttempt } = await supabase
    .from('attempts')
    .select('*')
    .eq('exam_id', examId)
    .eq('student_id', auth.user.id)
    .maybeSingle();

  if (existingAttempt) {
    // If already submitted, indicate redirect
    if (existingAttempt.status === 'submitted' || existingAttempt.status === 'auto_submitted') {
      return jsonSuccess({
        alreadySubmitted: true,
        attempt: existingAttempt,
        serverTime: now.toISOString(),
      });
    }

    // Attempt is in progress, resume it
    return jsonSuccess({
      alreadySubmitted: false,
      isResumed: true,
      attempt: existingAttempt,
      serverTime: now.toISOString(),
    });
  }

  // 3. Create new attempt
  // Deadline = now + duration_min minutes
  let deadline = new Date(now.getTime() + exam.duration_min * 60 * 1000);

  // If exam has a close_at time that comes before duration expires, clamp to close_at
  if (exam.close_at && new Date(exam.close_at) < deadline) {
    deadline = new Date(exam.close_at);
  }

  const { data: newAttempt, error: createError } = await supabase
    .from('attempts')
    .insert({
      exam_id: examId,
      student_id: auth.user.id,
      started_at: now.toISOString(),
      deadline_at: deadline.toISOString(),
      status: 'in_progress',
    })
    .select()
    .single();

  if (createError) {
    return jsonError(createError.message, 500);
  }

  return jsonSuccess(
    {
      alreadySubmitted: false,
      isResumed: false,
      attempt: newAttempt,
      serverTime: now.toISOString(),
    },
    201
  );
}
