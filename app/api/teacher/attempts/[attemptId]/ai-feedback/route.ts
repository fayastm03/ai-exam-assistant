import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateStudentFeedback } from '@/lib/ai/student-feedback';

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

/**
 * POST /api/teacher/attempts/[attemptId]/ai-feedback
 * Manages the student automated AI feedback row (source = 'ai_auto' or 'auto_template'):
 *
 * Actions:
 *  1. 'toggle_visibility' or { released: boolean }:
 *     Shows or hides the AI feedback card from the student (sets released = true/false).
 *  2. 'regenerate':
 *     Re-runs AI feedback generation. Rate limited to at most once per minute per attempt.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { attemptId } = await context.params;
  const supabase = createServiceRoleClient();

  // 1. Fetch attempt and exam
  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select('id, exam_id, status')
    .eq('id', attemptId)
    .single();

  if (attemptError || !attempt) {
    return jsonError('Attempt not found', 404);
  }

  // Guard: submitted or auto_submitted only
  if (attempt.status !== 'submitted' && attempt.status !== 'auto_submitted') {
    return jsonError('AI feedback is only available for submitted attempts', 400);
  }

  // Verify teacher ownership
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id')
    .eq('id', attempt.exam_id)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found', 404);
  }

  if (exam.teacher_id !== auth.user.id) {
    return jsonError('Access denied: You can only manage feedback for your own exams', 403);
  }

  let body: { action?: string; released?: boolean } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    body = {};
  }

  const { action, released: explicitReleased } = body;

  // 2. Fetch existing automated feedback row
  const { data: existingFeedback } = await supabase
    .from('attempt_feedback')
    .select('id, comment, source, released, updated_at')
    .eq('attempt_id', attempt.id)
    .is('question_id', null)
    .in('source', ['ai_auto', 'auto_template'])
    .maybeSingle();

  // Action: REGENERATE
  if (action === 'regenerate') {
    if (existingFeedback && existingFeedback.updated_at) {
      const lastUpdatedMs = new Date(existingFeedback.updated_at).getTime();
      const nowMs = Date.now();
      const elapsedSeconds = Math.floor((nowMs - lastUpdatedMs) / 1000);

      if (elapsedSeconds < 60) {
        const remainingSeconds = 60 - elapsedSeconds;
        return jsonError(
          `Regeneration is limited to once per minute per attempt. Please wait ${remainingSeconds}s.`,
          429
        );
      }
    }

    try {
      const regenerated = await generateStudentFeedback(attempt.id, { forceRegenerate: true });
      return jsonSuccess({
        ok: true,
        feedback: regenerated,
        message: 'AI feedback regenerated successfully',
      });
    } catch (err: unknown) {
      console.error('Error regenerating AI feedback:', err);
      return jsonError(
        err instanceof Error ? err.message : 'Failed to regenerate AI feedback',
        500
      );
    }
  }

  // Action: TOGGLE VISIBILITY / SET RELEASED
  if (!existingFeedback) {
    // If no automated feedback row exists yet, generate it first
    try {
      const newFeedback = await generateStudentFeedback(attempt.id);
      return jsonSuccess({
        ok: true,
        feedback: newFeedback,
      });
    } catch (err: unknown) {
      return jsonError(
        err instanceof Error ? err.message : 'Failed to generate initial AI feedback',
        500
      );
    }
  }

  // Determine new released status
  const targetReleased =
    typeof explicitReleased === 'boolean'
      ? explicitReleased
      : !existingFeedback.released;

  const { data: updated, error: updateError } = await supabase
    .from('attempt_feedback')
    .update({
      released: targetReleased,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existingFeedback.id)
    .select()
    .single();

  if (updateError || !updated) {
    return jsonError(`Failed to update visibility: ${updateError?.message}`, 500);
  }

  return jsonSuccess({
    ok: true,
    feedback: updated,
    message: targetReleased
      ? 'AI feedback is now visible to the student'
      : 'AI feedback hidden from student',
  });
}

