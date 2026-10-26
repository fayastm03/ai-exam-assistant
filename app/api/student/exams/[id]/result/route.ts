import { NextRequest } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { calculateScore, QuestionForScoring } from '@/lib/scoring';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/student/exams/[id]/result
 * Returns comprehensive student exam results after submission.
 * Strictly guarded:
 *  - Must be authenticated as a student.
 *  - Must belong to the authenticated student (attempt.student_id === auth.user.id).
 *  - Attempt status must be 'submitted' or 'auto_submitted'.
 *  - Exposes correct_option and explanation ONLY after submission.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  // 1. Fetch exam
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, title, duration_min, negative_marking, status')
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
    return jsonError('No attempt found for this exam', 404);
  }

  // 3. Strict guard: Prevent leaking correct_option / explanation before submission
  if (attempt.status !== 'submitted' && attempt.status !== 'auto_submitted') {
    return jsonError('This exam attempt is still in progress. Results are only available after submission.', 403);
  }

  // 4. Fetch questions with correct_option and explanation
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('id, number, text, options, marks, topic, correct_option, explanation')
    .eq('exam_id', examId)
    .order('number', { ascending: true });

  if (questionsError || !questions) {
    return jsonError('Failed to load exam questions for review', 500);
  }

  // 5. Fetch saved student answers
  const { data: savedAnswers, error: answersError } = await supabase
    .from('attempt_answers')
    .select('question_id, chosen_option, is_correct')
    .eq('attempt_id', attempt.id);

  if (answersError) {
    return jsonError('Failed to load student answers', 500);
  }

  const answersMap: Record<string, string | null> = {};
  (savedAnswers || []).forEach((a) => {
    answersMap[a.question_id] = a.chosen_option;
  });

  // 6. Source all scoring numbers from lib/scoring.ts
  const scoreResult = calculateScore(
    questions as QuestionForScoring[],
    answersMap,
    exam.negative_marking
  );

  // 7. Calculate time taken
  let timeTakenSeconds = 0;
  if (attempt.started_at && attempt.submitted_at) {
    const startMs = new Date(attempt.started_at).getTime();
    const submitMs = new Date(attempt.submitted_at).getTime();
    timeTakenSeconds = Math.max(0, Math.floor((submitMs - startMs) / 1000));
  }

  // 8. Build question review list
  const questionMap = new Map(scoreResult.questionResults.map((r) => [r.questionId, r]));

  const questionReviews = questions.map((q) => {
    const qResult = questionMap.get(q.id);
    return {
      id: q.id,
      number: q.number,
      text: q.text,
      options: q.options,
      marks: q.marks,
      topic: q.topic,
      correct_option: q.correct_option,
      explanation: q.explanation,
      chosen_option: qResult?.chosenOption ?? null,
      status: qResult?.status ?? 'skipped',
      score_earned: qResult?.scoreEarned ?? 0,
    };
  });

  return jsonSuccess({
    exam: {
      id: exam.id,
      title: exam.title,
      duration_min: exam.duration_min,
      negative_marking: exam.negative_marking,
    },
    attempt: {
      id: attempt.id,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
      status: attempt.status,
      time_taken_seconds: timeTakenSeconds,
    },
    score: {
      totalScore: scoreResult.totalScore,
      maxPossibleScore: scoreResult.maxPossibleScore,
      percentage: scoreResult.percentage,
      correctCount: scoreResult.correctCount,
      wrongCount: scoreResult.wrongCount,
      skippedCount: scoreResult.skippedCount,
      totalQuestions: scoreResult.totalQuestions,
    },
    topicPercentages: scoreResult.topicPercentages,
    topics: scoreResult.topics,
    weakTopics: scoreResult.weakTopics,
    questions: questionReviews,
  });
}
