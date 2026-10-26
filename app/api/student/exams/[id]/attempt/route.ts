import { NextRequest } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Deterministically shuffles array using string seed (attempt ID).
 */
function seededShuffle<T>(array: T[], seed: string): T[] {
  const result = [...array];
  let seedValue = 0;
  for (let i = 0; i < seed.length; i++) {
    seedValue = (seedValue * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }

  // Linear Congruential Generator
  let state = Math.abs(seedValue);
  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(state) % (i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * GET /api/student/exams/[id]/attempt
 * Fetches the questions and saved answers for an in-progress attempt.
 * SECURITY: correct_option and explanation are strictly redacted.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  // 1. Fetch published exam
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, title, instructions, duration_min, negative_marking, shuffle, status')
    .eq('id', examId)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found', 404);
  }

  // 2. Fetch student's attempt
  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select('id, exam_id, student_id, started_at, deadline_at, submitted_at, status, score')
    .eq('exam_id', examId)
    .eq('student_id', auth.user.id)
    .single();

  if (attemptError || !attempt) {
    return jsonError('No attempt found for this exam. Please start the exam first.', 404);
  }

  // If already submitted, indicate redirect
  if (attempt.status === 'submitted' || attempt.status === 'auto_submitted') {
    return jsonSuccess({
      alreadySubmitted: true,
      attempt,
      serverTime: new Date().toISOString(),
    });
  }

  // 3. Fetch questions: NEVER SELECT correct_option or explanation
  const { data: rawQuestions, error: questionsError } = await supabase
    .from('questions')
    .select('id, number, text, options, marks, topic')
    .eq('exam_id', examId)
    .order('number', { ascending: true });

  if (questionsError || !rawQuestions) {
    return jsonError('Failed to fetch exam questions', 500);
  }

  // Apply deterministic shuffle if enabled for exam
  let finalQuestions = rawQuestions;
  if (exam.shuffle) {
    finalQuestions = seededShuffle(rawQuestions, attempt.id);
  }

  // 4. Fetch existing saved answers for this attempt
  const { data: savedAnswers } = await supabase
    .from('attempt_answers')
    .select('question_id, chosen_option')
    .eq('attempt_id', attempt.id);

  const answersMap: Record<string, string | null> = {};
  (savedAnswers || []).forEach((ans) => {
    answersMap[ans.question_id] = ans.chosen_option;
  });

  return jsonSuccess({
    alreadySubmitted: false,
    exam,
    attempt,
    questions: finalQuestions,
    answers: answersMap,
    serverTime: new Date().toISOString(),
  });
}
