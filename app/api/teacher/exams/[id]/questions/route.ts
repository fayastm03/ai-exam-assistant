import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { questionCreateSchema } from '@/lib/validations/teacher';
import { handleZodError, jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/teacher/exams/[id]/questions
 * List all questions for an exam owned by the authenticated teacher.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  // Verify exam ownership
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id')
    .eq('id', examId)
    .eq('teacher_id', auth.user.id)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found or you do not have permission to view its questions', 404);
  }

  const { data: questions, error } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_id', examId)
    .order('number', { ascending: true });

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ questions: questions || [] });
}

/**
 * POST /api/teacher/exams/[id]/questions
 * Create a new question in an exam owned by the authenticated teacher.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  // Verify exam ownership
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id')
    .eq('id', examId)
    .eq('teacher_id', auth.user.id)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found or you do not have permission to add questions to it', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON in request body', 400);
  }

  const parsed = questionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  // Determine question number if not provided
  let questionNumber = parsed.data.number;
  if (!questionNumber) {
    const { data: lastQ } = await supabase
      .from('questions')
      .select('number')
      .eq('exam_id', examId)
      .order('number', { ascending: false })
      .limit(1)
      .maybeSingle();

    questionNumber = (lastQ?.number ?? 0) + 1;
  }

  const { data: question, error: insertError } = await supabase
    .from('questions')
    .insert({
      exam_id: examId,
      number: questionNumber,
      text: parsed.data.text,
      options: parsed.data.options,
      correct_option: parsed.data.correct_option.trim().toUpperCase(),
      marks: parsed.data.marks,
      topic: parsed.data.topic ?? null,
      explanation: parsed.data.explanation ?? null,
      source: parsed.data.source,
      review_status: parsed.data.review_status,
    })
    .select()
    .single();

  if (insertError) {
    return jsonError(insertError.message, 500);
  }

  return jsonSuccess({ question }, 201);
}

/**
 * PATCH /api/teacher/exams/[id]/questions
 * Batch update questions for an exam owned by the authenticated teacher.
 * Supports:
 * - { action: 'approve_all' } or { review_status: 'approved' }:
 *   Approves all draft questions that have a valid (non-UNSET, non-empty) correct_option.
 *   Optionally accepts { question_ids: string[] } to filter specific questions.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  // Verify exam ownership
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id')
    .eq('id', examId)
    .eq('teacher_id', auth.user.id)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found or you do not have permission to update its questions', 404);
  }

  let body: { action?: string; review_status?: string; question_ids?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON in request body', 400);
  }

  if (body.action === 'approve_all' || body.review_status === 'approved') {
    let query = supabase
      .from('questions')
      .update({
        review_status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('exam_id', examId)
      .eq('review_status', 'draft')
      .neq('correct_option', 'UNSET')
      .neq('correct_option', '')
      .not('correct_option', 'is', null);

    if (Array.isArray(body.question_ids) && body.question_ids.length > 0) {
      query = query.in('id', body.question_ids);
    }

    const { data: updatedQuestions, error: updateError } = await query.select('id');

    if (updateError) {
      return jsonError(updateError.message, 500);
    }

    const count = updatedQuestions?.length ?? 0;
    return jsonSuccess({
      count,
      message: count > 0 ? `Approved ${count} question${count === 1 ? '' : 's'}.` : 'No draft questions to approve.',
    });
  }

  return jsonError('Unsupported action. Provide action: "approve_all" or review_status: "approved".', 400);
}


