import { SupabaseClient } from '@supabase/supabase-js';
import { calculateScore, QuestionForScoring } from './scoring';

export interface AttemptToAutoSubmit {
  id: string;
  exam_id: string;
  student_id: string;
  status: string;
  deadline_at: string;
}

export interface ExamForAutoSubmit {
  id: string;
  negative_marking: number;
}

/**
 * Checks whether an in-progress attempt has passed its authoritative deadline.
 * If expired, automatically grades all saved answers and sets status to 'auto_submitted'.
 */
export async function checkAndAutoSubmitIfExpired(
  supabase: SupabaseClient,
  attempt: AttemptToAutoSubmit,
  exam: ExamForAutoSubmit,
  gracePeriodMs = 0
): Promise<{ wasAutoSubmitted: boolean; score?: number }> {
  if (attempt.status !== 'in_progress') {
    return { wasAutoSubmitted: false };
  }

  const now = new Date();
  const deadline = new Date(attempt.deadline_at);

  if (now.getTime() <= deadline.getTime() + gracePeriodMs) {
    return { wasAutoSubmitted: false };
  }

  // 1. Fetch questions for grading
  const { data: questions } = await supabase
    .from('questions')
    .select('id, marks, correct_option, topic')
    .eq('exam_id', exam.id);

  if (!questions || questions.length === 0) {
    return { wasAutoSubmitted: false };
  }

  // 2. Fetch saved student answers
  const { data: savedAnswers } = await supabase
    .from('attempt_answers')
    .select('id, question_id, chosen_option')
    .eq('attempt_id', attempt.id);

  const answersMap: Record<string, string | null> = {};
  (savedAnswers || []).forEach((a) => {
    answersMap[a.question_id] = a.chosen_option;
  });

  // 3. Compute score using code-based scoring engine
  const scoreResult = calculateScore(
    questions as QuestionForScoring[],
    answersMap,
    exam.negative_marking
  );

  const submittedAt = attempt.deadline_at || now.toISOString();

  // 4. Update attempt record
  await supabase
    .from('attempts')
    .update({
      status: 'auto_submitted',
      submitted_at: submittedAt,
      score: scoreResult.totalScore,
      updated_at: now.toISOString(),
    })
    .eq('id', attempt.id);

  // 5. Update is_correct on attempt_answers
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

  return { wasAutoSubmitted: true, score: scoreResult.totalScore };
}
