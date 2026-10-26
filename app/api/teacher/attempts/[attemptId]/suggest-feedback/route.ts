import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { calculateScore, QuestionForScoring } from '@/lib/scoring';
import { getAIProvider } from '@/lib/ai/provider';
import { loadPrompt } from '@/lib/ai/prompts';
import { suggestFeedbackResponseSchema } from '@/lib/validations/ai';

interface RouteContext {
  params: Promise<{ attemptId: string }>;
}

function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status: unknown }).status)
      : 0;
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('too many requests')
  );
}

/**
 * POST /api/teacher/attempts/[attemptId]/suggest-feedback
 * Generates AI feedback suggestions using prompts/v1/feedback.txt.
 * Uses attempt score, topic percentages, and wrong questions (question text and student answer only).
 * PRIVACY GUARD: Never includes student name or email.
 * Guarded: Only allowed on submitted attempts.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { attemptId } = await context.params;
  const supabase = createServiceRoleClient();

  // 1. Fetch attempt
  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select('id, exam_id, status, score')
    .eq('id', attemptId)
    .single();

  if (attemptError || !attempt) {
    return jsonError('Attempt not found', 404);
  }

  // 2. Guard: Must be submitted
  if (attempt.status !== 'submitted' && attempt.status !== 'auto_submitted') {
    return jsonError('Feedback suggestions are only available on submitted attempts', 400);
  }

  // 3. Fetch exam and verify teacher ownership
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id, negative_marking')
    .eq('id', attempt.exam_id)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found', 404);
  }

  if (exam.teacher_id !== auth.user.id) {
    return jsonError('Access denied: You can only view attempts for your own exams', 403);
  }

  // 4. Fetch questions
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('id, number, text, options, marks, topic, correct_option')
    .eq('exam_id', exam.id)
    .order('number', { ascending: true });

  if (questionsError || !questions) {
    return jsonError('Failed to fetch exam questions', 500);
  }

  // 5. Fetch student answers
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

  // 6. Calculate verified scores and per-topic percentages via lib/scoring.ts
  const scoreResult = calculateScore(
    questions as QuestionForScoring[],
    answersMap,
    exam.negative_marking
  );

  // 7. Format per-topic breakdown
  const topicLines: string[] = [];
  Object.entries(scoreResult.topics).forEach(([topic, stats]) => {
    topicLines.push(
      `- ${topic}: ${stats.percentage}% (${stats.earnedMarks} / ${stats.totalMarks} marks, ${stats.correctCount}/${stats.questionCount} correct)`
    );
  });
  const topicBreakdownStr = topicLines.length > 0 ? topicLines.join('\n') : 'No specific topics tagged.';

  // 8. Format wrong questions: QUESTION TEXT AND STUDENT'S ANSWER ONLY
  // STRICT PRIVACY: DO NOT INCLUDE STUDENT NAME OR EMAIL
  const questionsById = new Map(questions.map((q) => [q.id, q]));
  const wrongResults = scoreResult.questionResults.filter((r) => r.status === 'wrong');

  const wrongQuestionLines: string[] = [];
  wrongResults.forEach((wr) => {
    const q = questionsById.get(wr.questionId);
    if (!q) return;

    let studentAnswerText = wr.chosenOption || 'None';
    if (Array.isArray(q.options)) {
      const matchOpt = q.options.find(
        (o: { id?: string; key?: string; text?: string }) => (o.id || o.key) === wr.chosenOption
      );
      if (matchOpt && matchOpt.text) {
        studentAnswerText = `${wr.chosenOption}) ${matchOpt.text}`;
      }
    }

    wrongQuestionLines.push(
      `Question #${q.number}:\nText: ${q.text}\nStudent's Answer: ${studentAnswerText}`
    );
  });

  const wrongQuestionsStr =
    wrongQuestionLines.length > 0
      ? wrongQuestionLines.join('\n\n')
      : 'None (The student got zero questions wrong; all answers were either correct or unattempted).';

  // 9. Load prompt and fill placeholders
  const prompt = loadPrompt('feedback', {
    score: `${scoreResult.totalScore} / ${scoreResult.maxPossibleScore}`,
    percentage: String(scoreResult.percentage),
    topic_breakdown: topicBreakdownStr,
    wrong_questions: wrongQuestionsStr,
  });

  // 10. Call AI provider
  try {
    const provider = getAIProvider();
    const aiResult = await provider.generateText(prompt, suggestFeedbackResponseSchema);

    if (aiResult.isFlagged || !aiResult.data) {
      return jsonError(
        aiResult.flagReason || 'AI failed to generate feedback suggestion. Please try again.',
        502
      );
    }

    return jsonSuccess({
      feedback: aiResult.data.feedback,
      usage: aiResult.usage,
    });
  } catch (err: unknown) {
    if (isRateLimitError(err)) {
      return jsonError(
        'AI service is currently rate limited. Please wait a moment and try again.',
        429
      );
    }
    const message = err instanceof Error ? err.message : 'Unknown AI error';
    return jsonError('Error generating feedback suggestion: ' + message, 500);
  }
}
