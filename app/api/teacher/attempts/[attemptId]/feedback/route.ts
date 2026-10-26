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

  const { overallComment, questionComments, released } = parsed.data;

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
  const { data: existingOverall } = await supabase
    .from('attempt_feedback')
    .select('id')
    .eq('attempt_id', attempt.id)
    .is('question_id', null)
    .maybeSingle();

  if (overallComment && overallComment.trim().length > 0) {
    if (existingOverall) {
      await supabase
        .from('attempt_feedback')
        .update({
          comment: overallComment.trim(),
          released,
          teacher_id: auth.user.id,
          source: 'manual',
          updated_at: now,
        })
        .eq('id', existingOverall.id);
    } else {
      await supabase.from('attempt_feedback').insert({
        attempt_id: attempt.id,
        teacher_id: auth.user.id,
        question_id: null,
        comment: overallComment.trim(),
        released,
        source: 'manual',
        created_at: now,
        updated_at: now,
      });
    }
  } else if (existingOverall) {
    // If overall comment was cleared, remove the record
    await supabase.from('attempt_feedback').delete().eq('id', existingOverall.id);
  }

  // 5. Handle Per-Question Comments
  for (const qComment of questionComments) {
    const { data: existingQuestionFb } = await supabase
      .from('attempt_feedback')
      .select('id')
      .eq('attempt_id', attempt.id)
      .eq('question_id', qComment.questionId)
      .maybeSingle();

    if (qComment.comment && qComment.comment.trim().length > 0) {
      if (existingQuestionFb) {
        await supabase
          .from('attempt_feedback')
          .update({
            comment: qComment.comment.trim(),
            released,
            teacher_id: auth.user.id,
            source: 'manual',
            updated_at: now,
          })
          .eq('id', existingQuestionFb.id);
      } else {
        await supabase.from('attempt_feedback').insert({
          attempt_id: attempt.id,
          teacher_id: auth.user.id,
          question_id: qComment.questionId,
          comment: qComment.comment.trim(),
          released,
          source: 'manual',
          created_at: now,
          updated_at: now,
        });
      }
    } else if (existingQuestionFb) {
      // If question comment was cleared, delete the row
      await supabase.from('attempt_feedback').delete().eq('id', existingQuestionFb.id);
    }
  }

  return jsonSuccess({
    ok: true,
    released,
    message: released ? 'Feedback released to student' : 'Draft feedback saved successfully',
  });
}

