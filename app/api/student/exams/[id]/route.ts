import { NextRequest } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/student/exams/[id]
 * Exam overview and instructions for a published exam.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select(`
      id,
      title,
      instructions,
      duration_min,
      open_at,
      close_at,
      negative_marking,
      shuffle,
      status,
      created_at,
      questions (count)
    `)
    .eq('id', examId)
    .eq('status', 'published')
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found or is not currently available to take', 404);
  }

  // Fetch student's attempt if one exists
  const { data: attempt } = await supabase
    .from('attempts')
    .select('id, started_at, deadline_at, submitted_at, status, score')
    .eq('exam_id', examId)
    .eq('student_id', auth.user.id)
    .maybeSingle();

  const questionsCount = Array.isArray(exam.questions)
    ? (exam.questions[0] as { count?: number })?.count ?? 0
    : 0;

  const examCopy = { ...exam } as Record<string, unknown>;
  delete examCopy.questions;

  return jsonSuccess({
    exam: {
      ...examCopy,
      question_count: questionsCount,
    },
    attempt,
    alreadySubmitted: attempt?.status === 'submitted' || attempt?.status === 'auto_submitted',
    isInProgress: attempt?.status === 'in_progress',
    serverTime: new Date().toISOString(),
  });
}

