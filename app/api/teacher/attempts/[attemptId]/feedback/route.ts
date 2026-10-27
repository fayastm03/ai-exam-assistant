import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { handleZodError, jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { feedbackSaveSchema } from '@/lib/validations/teacher';

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

/**
 * POST /api/teacher/attempts/[attemptId]/feedback
 * Saves draft or releases feedback for an individual student attempt:
 *  - Guarded: Only the teacher who owns the exam can leave feedback.
 *  - Guarded: Feedback is allowed ONLY on submitted attempts (submitted or auto_submitted).
 *  - Handles:
 *    - 1 overall comment (up to 1000 characters)
 *    - Optional comment per question
 *    - Draft vs Released state
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { attemptId } = await context.params;
  const supabase = createServiceRoleClient();

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    body = {};
  }

  const parsed = feedbackSaveSchema.safeParse(body);
  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  const { overallComment, questionComments, released, source } = parsed.data;

  // 1. Fetch attempt
  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select('id, exam_id, status')
    .eq('id', attemptId)
    .single();

  if (attemptError || !attempt) {
    return jsonError('Attempt not found', 404);
  }

  // 2. Guard: Feedback allowed ONLY on submitted attempts
  if (attempt.status !== 'submitted' && attempt.status !== 'auto_submitted') {
    return jsonError('Feedback is only allowed on submitted attempts', 400);
  }

  // 3. Verify teacher owns the exam
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id')
    .eq('id', attempt.exam_id)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found', 404);
  }

  if (exam.teacher_id !== auth.user.id) {
    return jsonError('Access denied: You can only provide feedback for your own exams', 403);
  }

  const now = new Date().toISOString();

  // 4. Handle Overall Comment (question_id is NULL)
  const { data: existingOverall, error: selOverallErr } = await supabase
    .from('attempt_feedback')
    .select('id')
    .eq('attempt_id', attempt.id)
    .is('question_id', null)
    .maybeSingle();

  if (selOverallErr) {
    return jsonError('Failed to query existing feedback: ' + selOverallErr.message, 500);
  }

  if (overallComment && overallComment.trim().length > 0) {
    if (existingOverall) {
      const { error: updErr } = await supabase
        .from('attempt_feedback')
        .update({
          comment: overallComment.trim(),
          released,
          teacher_id: auth.user.id,
          source: source || 'manual',
          updated_at: now,
        })
        .eq('id', existingOverall.id);
      if (updErr) {
        return jsonError('Failed to update overall feedback: ' + updErr.message, 500);
      }
    } else {
      const { error: insErr } = await supabase.from('attempt_feedback').insert({
        attempt_id: attempt.id,
        teacher_id: auth.user.id,
        question_id: null,
        comment: overallComment.trim(),
        released,
        source: source || 'manual',
        created_at: now,
        updated_at: now,
      });
      if (insErr) {
        return jsonError('Failed to save overall feedback: ' + insErr.message, 500);
      }
    }
  } else if (existingOverall) {
    // If overall comment was cleared, remove the record
    const { error: delErr } = await supabase.from('attempt_feedback').delete().eq('id', existingOverall.id);
    if (delErr) {
      return jsonError('Failed to delete overall feedback: ' + delErr.message, 500);
    }
  }

  // 5. Handle Per-Question Comments
  for (const qComment of questionComments) {
    const { data: existingQuestionFb, error: selQErr } = await supabase
      .from('attempt_feedback')
      .select('id')
      .eq('attempt_id', attempt.id)
      .eq('question_id', qComment.questionId)
      .maybeSingle();

    if (selQErr) {
      return jsonError('Failed to query question feedback: ' + selQErr.message, 500);
    }

    if (qComment.comment && qComment.comment.trim().length > 0) {
      if (existingQuestionFb) {
        const { error: updQErr } = await supabase
          .from('attempt_feedback')
          .update({
            comment: qComment.comment.trim(),
            released,
            teacher_id: auth.user.id,
            source: 'manual',
            updated_at: now,
          })
          .eq('id', existingQuestionFb.id);
        if (updQErr) {
          return jsonError('Failed to update question feedback: ' + updQErr.message, 500);
        }
      } else {
        const { error: insQErr } = await supabase.from('attempt_feedback').insert({
          attempt_id: attempt.id,
          teacher_id: auth.user.id,
          question_id: qComment.questionId,
          comment: qComment.comment.trim(),
          released,
          source: 'manual',
          created_at: now,
          updated_at: now,
        });
        if (insQErr) {
          return jsonError('Failed to save question feedback: ' + insQErr.message, 500);
        }
      }
    } else if (existingQuestionFb) {
      // If question comment was cleared, delete the row
      const { error: delQErr } = await supabase.from('attempt_feedback').delete().eq('id', existingQuestionFb.id);
      if (delQErr) {
        return jsonError('Failed to delete question feedback: ' + delQErr.message, 500);
      }
    }
  }

  return jsonSuccess({
    ok: true,
    released,
    message: released ? 'Feedback released to student' : 'Draft feedback saved successfully',
  });
}

