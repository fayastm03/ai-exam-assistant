import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { examCreateSchema } from '@/lib/validations/teacher';
import { handleZodError, jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/teacher/exams
 * List all exams owned by the authenticated teacher.
 */
export async function GET(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();
  const { data: exams, error } = await supabase
    .from('exams')
    .select(`
      id,
      teacher_id,
      title,
      instructions,
      duration_min,
      open_at,
      close_at,
      negative_marking,
      shuffle,
      status,
      created_at,
      updated_at,
      questions (count)
    `)
    .eq('teacher_id', auth.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return jsonError(error.message, 500);
  }

  // Format count cleanly
  const formatted = (exams || []).map((exam) => {
    const questionsCount = Array.isArray(exam.questions)
      ? (exam.questions[0] as { count?: number })?.count ?? 0
      : 0;
    const examCopy = { ...exam } as Record<string, unknown>;
    delete examCopy.questions;
    return {
      ...examCopy,
      question_count: questionsCount,
    };
  });

  return jsonSuccess({ exams: formatted });
}

/**
 * POST /api/teacher/exams
 * Create a new exam authored by the authenticated teacher.
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

  const parsed = examCreateSchema.safeParse(body);
  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  const supabase = createServiceRoleClient();
  const { data: exam, error } = await supabase
    .from('exams')
    .insert({
      teacher_id: auth.user.id,
      title: parsed.data.title,
      instructions: parsed.data.instructions ?? null,
      duration_min: parsed.data.duration_min,
      open_at: parsed.data.open_at ?? null,
      close_at: parsed.data.close_at ?? null,
      negative_marking: parsed.data.negative_marking,
      shuffle: parsed.data.shuffle,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ exam }, 201);
}
