import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAIProvider } from '@/lib/ai/provider';
import { loadPrompt } from '@/lib/ai/prompts';
import { calculateScore, QuestionForScoring } from '@/lib/scoring';
import { studentFeedbackResponseSchema, trimFeedbackAtSentenceEnd } from '@/lib/validations/ai';

export interface GenerateStudentFeedbackOptions {
  /** If true, does not insert auto_template on AI failure (used in bulk generation) */
  skipTemplateFallback?: boolean;
  /** If true, replaces existing AI feedback even if already present */
  forceRegenerate?: boolean;
}

export interface StudentFeedbackResult {
  id: string;
  attempt_id: string;
  teacher_id: string;
  comment: string;
  source: 'ai_auto' | 'auto_template';
  released: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Builds a deterministic, kind, factual fallback feedback text
 * when the AI provider fails or is rate limited.
 */
export function buildAutoTemplateFeedback(params: {
  score: number;
  maxScore: number;
  percentage: number;
  weakTopics: string[];
  strongTopics: string[];
}): string {
  const { score, maxScore, percentage, weakTopics, strongTopics } = params;
  const parts: string[] = [];

  parts.push(`You completed the exam with a score of ${score} out of ${maxScore} (${percentage}%).`);

  if (strongTopics.length > 0) {
    parts.push(`You showed good understanding in ${strongTopics.slice(0, 2).join(' and ')}.`);
  } else if (percentage >= 50) {
    parts.push(`You showed consistent effort across the test questions.`);
  } else {
    parts.push(`Every exam is a learning opportunity to build from.`);
  }

  if (weakTopics.length > 0) {
    parts.push(`To improve, focus your revision on ${weakTopics.slice(0, 2).join(' and ')}.`);
  } else {
    parts.push(`Continue practicing similar problem sets to keep your skills sharp.`);
  }

  parts.push(`Review the question explanations below to clarify concepts and prepare for upcoming assessments.`);

  return trimFeedbackAtSentenceEnd(parts.join(' '), 1000);
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
 * Generates automated student feedback for a submitted attempt.
 *
 * Rules:
 * - Works ONLY on 'submitted' or 'auto_submitted' attempts.
 * - Input constructed strictly from score, max marks, topic breakdown, and wrong questions.
 * - PRIVACY: Strictly NO student names or emails passed to the prompt.
 * - Idempotent: checks for existing ai_auto or auto_template row first.
 * - Concurrency-safe: catches 23505 unique constraint violations if two tabs race.
 * - Resilience: falls back to kind, factual auto_template if AI fails (unless skipTemplateFallback is true).
 */
export async function generateStudentFeedback(
  attemptId: string,
  options: GenerateStudentFeedbackOptions = {}
): Promise<StudentFeedbackResult> {
  const supabase = createServiceRoleClient();

  // 1. Fetch attempt and exam
  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select('id, exam_id, student_id, status, score, started_at, submitted_at')
    .eq('id', attemptId)
    .single();

  if (attemptError || !attempt) {
    throw new Error('Attempt not found');
  }

  // Guard: strictly submitted or auto_submitted only
  if (attempt.status !== 'submitted' && attempt.status !== 'auto_submitted') {
    throw new Error('Automated feedback is only available for submitted attempts');
  }

  // 2. Check if automated feedback already exists (idempotency check)
  const { data: existingFeedback } = await supabase
    .from('attempt_feedback')
    .select('id, attempt_id, teacher_id, comment, source, released, created_at, updated_at')
    .eq('attempt_id', attempt.id)
    .is('question_id', null)
    .in('source', ['ai_auto', 'auto_template'])
    .maybeSingle();

  if (existingFeedback && !options.forceRegenerate) {
    return existingFeedback as StudentFeedbackResult;
  }

  // 3. Fetch exam for teacher_id and negative marking
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id, title, negative_marking')
    .eq('id', attempt.exam_id)
    .single();

  if (examError || !exam) {
    throw new Error('Exam not found');
  }

  // 4. Fetch questions and saved answers to build scoring and wrong question details
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('id, number, text, options, marks, topic, correct_option')
    .eq('exam_id', exam.id)
    .order('number', { ascending: true });

  if (questionsError || !questions) {
    throw new Error('Failed to load questions for feedback generation');
  }

  const { data: savedAnswers, error: answersError } = await supabase
    .from('attempt_answers')
    .select('question_id, chosen_option')
    .eq('attempt_id', attempt.id);

  if (answersError) {
    throw new Error('Failed to load answers for feedback generation');
  }

  const answersMap: Record<string, string | null> = {};
  (savedAnswers || []).forEach((a) => {
    answersMap[a.question_id] = a.chosen_option;
  });

  const scoreResult = calculateScore(
    questions as QuestionForScoring[],
    answersMap,
    exam.negative_marking
  );

  // 5. Build prompt input data
  // Topic percentages
  const topicLines: string[] = [];
  const strongTopics: string[] = [];
  Object.entries(scoreResult.topics).forEach(([topic, stats]) => {
    topicLines.push(
      `- ${topic}: ${stats.percentage}% (${stats.earnedMarks} / ${stats.totalMarks} marks, ${stats.correctCount}/${stats.questionCount} correct)`
    );
    if (stats.percentage >= 70) {
      strongTopics.push(topic);
    }
  });
  const topicPercentagesStr =
    topicLines.length > 0 ? topicLines.join('\n') : 'General topics only.';

  // Wrong questions: question text, student's answer, and correct answer (NO student name/email)
  const questionsById = new Map(questions.map((q) => [q.id, q]));
  const wrongResults = scoreResult.questionResults.filter((r) => r.status === 'wrong');

  const wrongQuestionLines: string[] = [];
  wrongResults.forEach((wr) => {
    const q = questionsById.get(wr.questionId);
    if (!q) return;

    let studentAnswerText = wr.chosenOption || 'None';
    let correctAnswerText = q.correct_option;

    if (Array.isArray(q.options)) {
      const matchOpt = q.options.find(
        (o: { id?: string; key?: string; text?: string }) =>
          (o.id || o.key) === wr.chosenOption
      );
      if (matchOpt && matchOpt.text) {
        studentAnswerText = `${wr.chosenOption}) ${matchOpt.text}`;
      }

      const matchCorrect = q.options.find(
        (o: { id?: string; key?: string; text?: string }) =>
          (o.id || o.key) === q.correct_option
      );
      if (matchCorrect && matchCorrect.text) {
        correctAnswerText = `${q.correct_option}) ${matchCorrect.text}`;
      }
    }

    wrongQuestionLines.push(
      `Question #${q.number}:\nText: ${q.text}\nStudent's Answer: ${studentAnswerText}\nCorrect Answer: ${correctAnswerText}`
    );
  });

  const wrongQuestionsStr =
    wrongQuestionLines.length > 0
      ? wrongQuestionLines.join('\n\n')
      : 'None (The student got zero questions wrong; all attempted answers were correct).';

  // 6. Load base prompt from prompts/v1/feedback_student.txt and append input data
  const basePrompt = loadPrompt('feedback_student');
  const fullPrompt = `${basePrompt}

--- INPUT DATA ---
Total Score: ${scoreResult.totalScore} / ${scoreResult.maxPossibleScore} (${scoreResult.percentage}%)

Per-Topic Performance:
${topicPercentagesStr}

Questions Answered Incorrectly:
${wrongQuestionsStr}`;

  const now = new Date().toISOString();

  // 7. Call AI Provider with fallback handling
  let feedbackText = '';
  let source: 'ai_auto' | 'auto_template' = 'ai_auto';

  try {
    const provider = getAIProvider();
    const aiResult = await provider.generateText(fullPrompt, studentFeedbackResponseSchema);

    if (aiResult.isFlagged || !aiResult.data || !aiResult.data.feedback) {
      throw new Error(aiResult.flagReason || 'AI returned invalid or empty feedback');
    }

    feedbackText = trimFeedbackAtSentenceEnd(aiResult.data.feedback, 1000);
    source = 'ai_auto';
  } catch (err: unknown) {
    if (options.skipTemplateFallback) {
      // In bulk mode, do not insert template rows; propagate the error
      const isRateLimit = isRateLimitError(err);
      const errorToThrow = new Error(
        isRateLimit
          ? 'Rate limit reached, try again in a minute'
          : err instanceof Error
            ? err.message
            : 'AI feedback generation failed'
      );
      (errorToThrow as unknown as { isRateLimit?: boolean }).isRateLimit = isRateLimit;
      throw errorToThrow;
    }

    console.warn(
      `[AI:StudentFeedback] AI generation failed for attempt ${attemptId}. Using auto_template fallback. Error: ${
        err instanceof Error ? err.message : String(err)
      }`
    );

    feedbackText = buildAutoTemplateFeedback({
      score: scoreResult.totalScore,
      maxScore: scoreResult.maxPossibleScore,
      percentage: scoreResult.percentage,
      weakTopics: scoreResult.weakTopics,
      strongTopics,
    });
    source = 'auto_template';
  }

  // 8. Insert or update feedback row
  // The server sets released = true on ai_auto and auto_template rows.
  if (options.forceRegenerate && existingFeedback) {
    const { data: updated, error: updateError } = await supabase
      .from('attempt_feedback')
      .update({
        comment: feedbackText,
        source,
        released: existingFeedback.released, // retain previous visibility setting
        updated_at: now,
      })
      .eq('id', existingFeedback.id)
      .select()
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to update feedback: ${updateError?.message}`);
    }

    return updated as StudentFeedbackResult;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('attempt_feedback')
    .insert({
      attempt_id: attempt.id,
      teacher_id: exam.teacher_id,
      question_id: null,
      comment: feedbackText,
      source,
      released: true,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (insertError) {
    // 23505: Unique constraint violation (e.g. concurrent race between two tabs)
    if (insertError.code === '23505' || insertError.message.includes('unique')) {
      const { data: racedExisting } = await supabase
        .from('attempt_feedback')
        .select('id, attempt_id, teacher_id, comment, source, released, created_at, updated_at')
        .eq('attempt_id', attempt.id)
        .is('question_id', null)
        .in('source', ['ai_auto', 'auto_template'])
        .maybeSingle();

      if (racedExisting) {
        return racedExisting as StudentFeedbackResult;
      }
    }

    throw new Error(`Failed to save student feedback: ${insertError.message}`);
  }

  return inserted as StudentFeedbackResult;
}

