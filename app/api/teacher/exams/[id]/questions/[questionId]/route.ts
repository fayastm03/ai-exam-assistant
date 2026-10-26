import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { questionUpdateSchema } from '@/lib/validations/teacher';
import { handleZodError, jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string; questionId: string }>;
}

type OwnershipVerification =
  | {
      ok: true;
      exam: Record<string, unknown>;
      question: Record<string, unknown>;
      supabase: ReturnType<typeof createServiceRoleClient>;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

/**
 * Verifies that the exam exists, belongs to the teacher, and the question exists within that exam.
 */
async function verifyExamAndQuestionOwnership(
  examId: string,
  questionId: string,
  teacherId: string
): Promise<OwnershipVerification> {
  const supabase = createServiceRoleClient();

  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id')
    .eq('id', examId)
    .eq('teacher_id', teacherId)
    .single();

  if (examError || !exam) {
    return { ok: false, status: 404, message: 'Exam not found or permission denied' };
  }

  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .eq('exam_id', examId)
    .single();

  if (questionError || !question) {
    return { ok: false, status: 404, message: 'Question not found in this exam' };
  }

  return { ok: true, exam, question, supabase };
}

/**
 * GET /api/teacher/exams/[id]/questions/[questionId]
 * Get a single question belonging to an exam owned by the teacher.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id: examId, questionId } = await context.params;
  const verified = await verifyExamAndQuestionOwnership(examId, questionId, auth.user.id);
  if (!verified.ok) {
    return jsonError(verified.message, verified.status);
  }

  return jsonSuccess({ question: verified.question });
}

/**
 * PATCH /api/teacher/exams/[id]/questions/[questionId]
 * Update a question in an exam owned by the teacher.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id: examId, questionId } = await context.params;
  const verified = await verifyExamAndQuestionOwnership(examId, questionId, auth.user.id);
  if (!verified.ok) {
    return jsonError(verified.message, verified.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON in request body', 400);
  }

  const parsed = questionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.number !== undefined) updatePayload.number = parsed.data.number;
  if (parsed.data.text !== undefined) updatePayload.text = parsed.data.text;
  if (parsed.data.options !== undefined) updatePayload.options = parsed.data.options;
  if (parsed.data.correct_option !== undefined) {
    updatePayload.correct_option = parsed.data.correct_option.trim().toUpperCase();
  }
  if (parsed.data.marks !== undefined) updatePayload.marks = parsed.data.marks;
  if (parsed.data.topic !== undefined) updatePayload.topic = parsed.data.topic;
  if (parsed.data.explanation !== undefined) updatePayload.explanation = parsed.data.explanation;
  if (parsed.data.source !== undefined) updatePayload.source = parsed.data.source;
  if (parsed.data.review_status !== undefined) updatePayload.review_status = parsed.data.review_status;

  const { data: updated, error: updateError } = await verified.supabase
    .from('questions')
    .update(updatePayload)
    .eq('id', questionId)
    .select()
    .single();

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  return jsonSuccess({ question: updated });
}

/**
 * DELETE /api/teacher/exams/[id]/questions/[questionId]
 * Delete a question from an exam owned by the teacher.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id: examId, questionId } = await context.params;
  const verified = await verifyExamAndQuestionOwnership(examId, questionId, auth.user.id);
  if (!verified.ok) {
    return jsonError(verified.message, verified.status);
  }

  const { error: deleteError } = await verified.supabase
    .from('questions')
    .delete()
    .eq('id', questionId);

  if (deleteError) {
    return jsonError(deleteError.message, 500);
  }

  return jsonSuccess({ message: 'Question deleted successfully' });
}
