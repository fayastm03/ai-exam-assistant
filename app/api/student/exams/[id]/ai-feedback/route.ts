import { NextRequest } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateStudentFeedback } from '@/lib/ai/student-feedback';

export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/student/exams/[id]/ai-feedback
 * Returns the automated AI/template feedback for the authenticated student's attempt.
 *
 * Rules:
 *  - Guard: Student role required.
 *  - Guard: Attempt must belong to the authenticated student.
 *  - Guard: Attempt status must be 'submitted' or 'auto_submitted'.
 *  - Idempotent: If no ai_auto/auto_template row exists, generates one on the fly.
 *  - Privacy/Control: If the teacher has hidden the AI feedback (released = false),
 *    returns { feedback: null, hidden: true }.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  // 1. Fetch student's attempt for this exam
  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select('id, exam_id, student_id, status')
    .eq('exam_id', examId)
    .eq('student_id', auth.user.id)
    .maybeSingle();

  if (attemptError || !attempt) {
    return jsonError('No attempt found for this exam', 404);
  }

  // 2. Guard: Must be submitted
  if (attempt.status !== 'submitted' && attempt.status !== 'auto_submitted') {
    return jsonError('Automated feedback is only available for submitted attempts', 400);
  }

  // 3. Check for existing automated feedback row
  const { data: existingFeedback } = await supabase
    .from('attempt_feedback')
    .select('id, comment, source, released, updated_at')
    .eq('attempt_id', attempt.id)
    .is('question_id', null)
    .in('source', ['ai_auto', 'auto_template'])
    .maybeSingle();

  if (existingFeedback) {
    // If teacher has hidden this AI feedback row from the student, do not return the text
    if (!existingFeedback.released) {
      return jsonSuccess({
        feedback: null,
        hidden: true,
        source: existingFeedback.source,
      });
    }

    return jsonSuccess({
      feedback: existingFeedback.comment,
      hidden: false,
      source: existingFeedback.source,
    });
  }

  // 4. Generate automated feedback on demand
  try {
    const generated = await generateStudentFeedback(attempt.id);

    if (!generated.released) {
      return jsonSuccess({
        feedback: null,
        hidden: true,
        source: generated.source,
      });
    }

    return jsonSuccess({
      feedback: generated.comment,
      hidden: false,
      source: generated.source,
    });
  } catch (err: unknown) {
    console.error('Error generating student AI feedback:', err);
    return jsonError(
      err instanceof Error ? err.message : 'Failed to generate AI feedback',
      500
    );
  }
}

