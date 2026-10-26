import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { examUpdateSchema } from '@/lib/validations/teacher';
import { handleZodError, jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/teacher/exams/[id]
 * Get exam details and questions for an exam owned by the authenticated teacher.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const supabase = createServiceRoleClient();

  // Fetch exam owned by teacher
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('*')
    .eq('id', id)
    .eq('teacher_id', auth.user.id)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found or you do not have permission to view it', 404);
  }

  // Fetch questions for this exam
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_id', id)
    .order('number', { ascending: true });

  if (questionsError) {
    return jsonError(questionsError.message, 500);
  }

  return jsonSuccess({
    exam,
    questions: questions || [],
  });
}

/**
 * PATCH /api/teacher/exams/[id]
 * Update exam details (only if owned by the authenticated teacher).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const supabase = createServiceRoleClient();

  // Verify ownership
  const { data: existing, error: findError } = await supabase
    .from('exams')
    .select('id, teacher_id, status')
    .eq('id', id)
    .eq('teacher_id', auth.user.id)
    .single();

  if (findError || !existing) {
    return jsonError('Exam not found or you do not have permission to edit it', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON in request body', 400);
  }

  const parsed = examUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title;
  if (parsed.data.instructions !== undefined) updatePayload.instructions = parsed.data.instructions;
  if (parsed.data.duration_min !== undefined) updatePayload.duration_min = parsed.data.duration_min;
  if (parsed.data.open_at !== undefined) updatePayload.open_at = parsed.data.open_at;
  if (parsed.data.close_at !== undefined) updatePayload.close_at = parsed.data.close_at;
  if (parsed.data.negative_marking !== undefined) updatePayload.negative_marking = parsed.data.negative_marking;
  if (parsed.data.shuffle !== undefined) updatePayload.shuffle = parsed.data.shuffle;
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;

  const { data: updated, error: updateError } = await supabase
    .from('exams')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  return jsonSuccess({ exam: updated });
}

/**
 * DELETE /api/teacher/exams/[id]
 * Delete an exam (only if owned by the authenticated teacher).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const supabase = createServiceRoleClient();

  // Verify ownership
  const { data: existing, error: findError } = await supabase
    .from('exams')
    .select('id, teacher_id')
    .eq('id', id)
    .eq('teacher_id', auth.user.id)
    .single();

  if (findError || !existing) {
    return jsonError('Exam not found or you do not have permission to delete it', 404);
  }

  const { error: deleteError } = await supabase
    .from('exams')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return jsonError(deleteError.message, 500);
  }

  return jsonSuccess({ message: 'Exam deleted successfully' });
}

