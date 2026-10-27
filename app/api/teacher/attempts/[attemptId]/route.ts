import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { calculateScore, QuestionForScoring } from '@/lib/scoring';
import { checkAndAutoSubmitIfExpired } from '@/lib/attempt-autosubmit';

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

/**
 * GET /api/teacher/attempts/[attemptId]
 * Fetches an individual student's attempt for the teacher:
 *  - Guarded: Only the teacher who owns the exam can view the attempt.
 *  - Guarded: Attempt must be submitted or auto_submitted.
 *  - Returns student answers, score, weak topics, and saved feedback (both draft and released).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { attemptId } = await context.params;
  const supabase = createServiceRoleClient();

  // 1. Fetch attempt with student profile
  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select(`
      id,
      exam_id,
      student_id,
      started_at,
      deadline_at,
      submitted_at,
      status,
      score,
      profiles:student_id (
        id,
        name
      )
    `)
    .eq('id', attemptId)
    .single();

  if (attemptError || !attempt) {
    return jsonError('Attempt not found', 404);
  }

  // 2. Fetch exam and verify teacher ownership
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id, title, duration_min, negative_marking, status')
    .eq('id', attempt.exam_id)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found', 404);
  }

  if (exam.teacher_id !== auth.user.id) {
    return jsonError('Access denied: You can only view attempts for your own exams', 403);
  }

  // 2b. Edge Case 4: If student closed browser mid-test, auto-submit and score when teacher reads it
  if (attempt.status === 'in_progress') {
    const autoSubmitRes = await checkAndAutoSubmitIfExpired(supabase, attempt, exam);
    if (autoSubmitRes.wasAutoSubmitted) {
      attempt.status = 'auto_submitted';
      attempt.score = autoSubmitRes.score;
    }
  }

  // 3. Guard: Must be submitted
  if (attempt.status !== 'submitted' && attempt.status !== 'auto_submitted') {
    return jsonError('Feedback is only allowed on submitted attempts', 400);
  }

  // 4. Fetch all questions for this exam
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('id, number, text, options, marks, topic, correct_option, explanation')
    .eq('exam_id', exam.id)
    .order('number', { ascending: true });

  if (questionsError || !questions) {
    return jsonError('Failed to fetch exam questions', 500);
  }

  // 5. Fetch student answers for this attempt
  const { data: savedAnswers, error: answersError } = await supabase
    .from('attempt_answers')
    .select('question_id, chosen_option, is_correct')
    .eq('attempt_id', attempt.id);

  if (answersError) {
    return jsonError('Failed to fetch student answers', 500);
  }

  const answersMap: Record<string, string | null> = {};
  (savedAnswers || []).forEach((a) => {
    answersMap[a.question_id] = a.chosen_option;
  });

  // 6. Source score and topic breakdown from lib/scoring.ts
  const scoreResult = calculateScore(
    questions as QuestionForScoring[],
    answersMap,
    exam.negative_marking
  );

  let timeTakenSeconds = 0;
  if (attempt.started_at && attempt.submitted_at) {
    const startMs = new Date(attempt.started_at).getTime();
    const submitMs = new Date(attempt.submitted_at).getTime();
    timeTakenSeconds = Math.max(0, Math.floor((submitMs - startMs) / 1000));
  }

  // 7. Fetch all existing feedback for this attempt
  const { data: feedbackRows, error: feedbackError } = await supabase
    .from('attempt_feedback')
    .select('id, question_id, comment, released, source, updated_at')
    .eq('attempt_id', attempt.id);

  if (feedbackError) {
    return jsonError('Failed to fetch feedback', 500);
  }

  // Separate teacher's overall feedback, student automatic AI feedback, and question comments
  let overallFeedback: {
    id: string;
    comment: string;
    released: boolean;
    source?: string;
    updated_at: string;
  } | null = null;

  let aiAutoFeedback: {
    id: string;
    comment: string;
    released: boolean;
    source: 'ai_auto' | 'auto_template';
    updated_at: string;
  } | null = null;

  const questionFeedbackMap: Record<
    string,
    { id: string; comment: string; released: boolean; source?: string; updated_at: string }
  > = {};

  (feedbackRows || []).forEach((f) => {
    if (!f.question_id) {
      if (f.source === 'ai_auto' || f.source === 'auto_template') {
        aiAutoFeedback = {
          id: f.id,
          comment: f.comment,
          released: f.released,
          source: f.source as 'ai_auto' | 'auto_template',
          updated_at: f.updated_at,
        };
      } else {
        overallFeedback = {
          id: f.id,
          comment: f.comment,
          released: f.released,
          source: f.source,
          updated_at: f.updated_at,
        };
      }
    } else {
      questionFeedbackMap[f.question_id] = {
        id: f.id,
        comment: f.comment,
        released: f.released,
        source: f.source,
        updated_at: f.updated_at,
      };
    }
  });

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
      feedback: questionFeedbackMap[q.id] || null,
    };
  });

  type ProfileJoin = { id?: string; name?: string } | { id?: string; name?: string }[] | null;
  const profile = attempt.profiles as ProfileJoin;
  const studentName =
    (Array.isArray(profile) ? profile[0]?.name : profile?.name) || 'Anonymous Student';

  return jsonSuccess({
    exam: {
      id: exam.id,
      title: exam.title,
      duration_min: exam.duration_min,
      negative_marking: exam.negative_marking,
      status: exam.status,
    },
    attempt: {
      id: attempt.id,
      student_id: attempt.student_id,
      student_name: studentName,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
      status: attempt.status,
      time_taken_seconds: timeTakenSeconds,
      score: scoreResult.totalScore,
      max_possible_score: scoreResult.maxPossibleScore,
      percentage: scoreResult.percentage,
      correct_count: scoreResult.correctCount,
      wrong_count: scoreResult.wrongCount,
      skipped_count: scoreResult.skippedCount,
      weak_topics: scoreResult.weakTopics,
    },
    feedback: {
      overall: overallFeedback,
      aiAuto: aiAutoFeedback,
      byQuestion: questionFeedbackMap,
    },
    questions: questionReviews,
  });
}

