import { NextRequest } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { submitExamSchema } from '@/lib/validations/student';
import { handleZodError, jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { calculateScore, QuestionForScoring } from '@/lib/scoring';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/student/exams/[id]/submit
 * Submits an exam attempt and performs automated code-based MCQ grading.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    body = {};
  }

  const parsed = submitExamSchema.safeParse(body);
  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  // 1. Fetch exam details (for negative marking)
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, title, negative_marking')
    .eq('id', examId)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found', 404);
  }

  // 2. Fetch student attempt
  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select('id, status, score')
    .eq('exam_id', examId)
    .eq('student_id', auth.user.id)
    .single();

  if (attemptError || !attempt) {
    return jsonError('Attempt not found for this exam', 404);
  }

  // If already submitted, return the already calculated score
  if (attempt.status === 'submitted' || attempt.status === 'auto_submitted') {
    return jsonSuccess({
      ok: true,
      alreadySubmitted: true,
      score: attempt.score,
      status: attempt.status,
    });
  }

  // 3. Fetch questions with correct_option for grading
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('id, marks, correct_option, topic')
    .eq('exam_id', examId);

  if (questionsError || !questions) {
    return jsonError('Failed to fetch questions for grading', 500);
  }

  // 4. Fetch all saved student answers
  const { data: savedAnswers } = await supabase
    .from('attempt_answers')
    .select('id, question_id, chosen_option')
    .eq('attempt_id', attempt.id);

  const answersMap: Record<string, string | null> = {};
  (savedAnswers || []).forEach((a) => {
    answersMap[a.question_id] = a.chosen_option;
  });

  // 5. Automated code-based MCQ scoring
  const scoreResult = calculateScore(
    questions as QuestionForScoring[],
    answersMap,
    exam.negative_marking
  );

  const now = new Date();
  const finalStatus = parsed.data.autoSubmitted ? 'auto_submitted' : 'submitted';

  // 6. Update attempt record
  const { data: updatedAttempt, error: updateError } = await supabase
    .from('attempts')
    .update({
      status: finalStatus,
      submitted_at: now.toISOString(),
      score: scoreResult.totalScore,
      updated_at: now.toISOString(),
    })
    .eq('id', attempt.id)
    .select()
    .single();

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  // 7. Update is_correct on attempt_answers
  for (const qResult of scoreResult.questionResults) {
    const isCorrect = qResult.status === 'correct';
    await supabase
      .from('attempt_answers')
      .upsert(
        {
          attempt_id: attempt.id,
          question_id: qResult.questionId,
          chosen_option: qResult.chosenOption,
          is_correct: isCorrect,
          updated_at: now.toISOString(),
        },
        { onConflict: 'attempt_id,question_id' }
      );
  }

  return jsonSuccess({
    ok: true,
    score: scoreResult.totalScore,
    percentage: scoreResult.percentage,
    attempt: updatedAttempt,
    weakTopics: scoreResult.weakTopics,
  });
}

