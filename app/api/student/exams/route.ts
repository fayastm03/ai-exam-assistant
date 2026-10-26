import { NextRequest } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/student/exams
 * Lists all published exams available for students to take.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  // Fetch published exams
  const { data: exams, error } = await supabase
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
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    return jsonError(error.message, 500);
  }

  // Fetch current student's attempts across published exams
  const { data: myAttempts } = await supabase
    .from('attempts')
    .select('id, exam_id, started_at, deadline_at, submitted_at, status, score')
    .eq('student_id', auth.user.id);

  const attemptByExam = new Map<string, unknown>();
  (myAttempts || []).forEach((att) => {
    attemptByExam.set(att.exam_id, att);
  });

  const formatted = (exams || []).map((exam) => {
    const questionsCount = Array.isArray(exam.questions)
      ? (exam.questions[0] as { count?: number })?.count ?? 0
      : 0;

    const examCopy = { ...exam } as Record<string, unknown>;
    delete examCopy.questions;

    return {
      ...examCopy,
      question_count: questionsCount,
      my_attempt: attemptByExam.get(exam.id) || null,
    };
  });

  return jsonSuccess({ exams: formatted });
}
