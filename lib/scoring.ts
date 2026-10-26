/**
 * Pure scoring functions for MCQ exams.
 * No database calls or external dependencies.
 */

export interface QuestionForScoring {
  id: string;
  marks: number;
  correct_option: string;
  topic?: string | null;
}

export interface StudentAnswer {
  question_id: string;
  chosen_option?: string | null;
}

export type StudentAnswersInput =
  | StudentAnswer[]
  | Record<string, string | null | undefined>
  | Map<string, string | null | undefined>;

export interface ScoringOptions {
  /** If true, the final total score is allowed to be negative. Defaults to false. */
  allowNegativeTotal?: boolean;
}

export type AnswerStatus = 'correct' | 'wrong' | 'skipped';

export interface QuestionResult {
  questionId: string;
  topic: string;
  marks: number;
  correctOption: string;
  chosenOption: string | null;
  status: AnswerStatus;
  scoreEarned: number;
}

export interface TopicScore {
  topic: string;
  totalMarks: number;
  earnedMarks: number;
  percentage: number;
  questionCount: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
}

export interface ScoreResult {
  totalScore: number;
  rawScore: number;
  maxPossibleScore: number;
  percentage: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  questionResults: QuestionResult[];
  topics: Record<string, TopicScore>;
  topicPercentages: Record<string, number>;
  weakTopics: string[];
}

/**
 * Normalizes input answers into a lookup Map of questionId -> chosenOption.
 */
function normalizeAnswers(
  input: StudentAnswersInput
): Map<string, string | null> {
  const map = new Map<string, string | null>();

  if (Array.isArray(input)) {
    for (const item of input) {
      if (item && typeof item.question_id === 'string') {
        const option =
          typeof item.chosen_option === 'string'
            ? item.chosen_option.trim()
            : null;
        map.set(item.question_id, option && option.length > 0 ? option : null);
      }
    }
  } else if (input instanceof Map) {
    for (const [key, val] of input.entries()) {
      const option = typeof val === 'string' ? val.trim() : null;
      map.set(key, option && option.length > 0 ? option : null);
    }
  } else if (input && typeof input === 'object') {
    for (const [key, val] of Object.entries(input)) {
      const option = typeof val === 'string' ? val.trim() : null;
      map.set(key, option && option.length > 0 ? option : null);
    }
  }

  return map;
}

/**
 * Checks whether chosen option matches correct option (case-insensitive & trimmed).
 */
export function isAnswerCorrect(
  chosenOption?: string | null,
  correctOption?: string | null
): boolean {
  if (!chosenOption || !correctOption) return false;
  return chosenOption.trim().toUpperCase() === correctOption.trim().toUpperCase();
}

/**
 * Determines answer status: 'correct', 'wrong', or 'skipped'.
 */
export function getAnswerStatus(
  chosenOption?: string | null,
  correctOption?: string | null
): AnswerStatus {
  if (chosenOption === undefined || chosenOption === null || chosenOption.trim() === '') {
    return 'skipped';
  }
  return isAnswerCorrect(chosenOption, correctOption) ? 'correct' : 'wrong';
}

/**
 * Calculates score for an exam attempt.
 *
 * Rules:
 * - correct: earns question marks (+marks)
 * - skipped: earns 0
 * - wrong: earns 0 (if negativeMarking <= 0) or minus (marks * negativeMarking)
 * - total score is never below 0 unless options.allowNegativeTotal is true
 * - returns per-topic percentage and weak topics list (< 50% percentage)
 */
export function calculateScore(
  questions: QuestionForScoring[],
  answers: StudentAnswersInput,
  negativeMarking: number = 0,
  options?: ScoringOptions
): ScoreResult {
  const answerMap = normalizeAnswers(answers);
  const allowNegative = options?.allowNegativeTotal ?? false;
  const negMultiplier = Math.max(0, Number(negativeMarking) || 0);

  let rawScore = 0;
  let maxPossibleScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  const questionResults: QuestionResult[] = [];
  const topicMap = new Map<string, TopicScore>();

  for (const q of questions) {
    const qMarks = Number(q.marks) || 0;
    maxPossibleScore += qMarks;

    const topicName = q.topic && q.topic.trim().length > 0 ? q.topic.trim() : 'General';
    const chosen = answerMap.has(q.id) ? answerMap.get(q.id)! : null;
    const status = getAnswerStatus(chosen, q.correct_option);

    let scoreEarned = 0;
    if (status === 'correct') {
      scoreEarned = qMarks;
      correctCount++;
    } else if (status === 'skipped') {
      scoreEarned = 0;
      skippedCount++;
    } else {
      scoreEarned = negMultiplier > 0 ? -(qMarks * negMultiplier) : 0;
      wrongCount++;
    }

    rawScore += scoreEarned;

    questionResults.push({
      questionId: q.id,
      topic: topicName,
      marks: qMarks,
      correctOption: q.correct_option,
      chosenOption: chosen,
      status,
      scoreEarned,
    });

    // Accumulate per-topic statistics
    let tScore = topicMap.get(topicName);
    if (!tScore) {
      tScore = {
        topic: topicName,
        totalMarks: 0,
        earnedMarks: 0,
        percentage: 0,
        questionCount: 0,
        correctCount: 0,
        wrongCount: 0,
        skippedCount: 0,
      };
      topicMap.set(topicName, tScore);
    }

    tScore.totalMarks += qMarks;
    tScore.earnedMarks += scoreEarned;
    tScore.questionCount += 1;
    if (status === 'correct') tScore.correctCount += 1;
    else if (status === 'wrong') tScore.wrongCount += 1;
    else tScore.skippedCount += 1;
  }

  // Calculate topic percentages & identify weak topics
  const topics: Record<string, TopicScore> = {};
  const topicPercentages: Record<string, number> = {};
  const weakTopics: string[] = [];

  for (const [topicName, tScore] of topicMap.entries()) {
    // Round earnedMarks to 4 decimal places to prevent FP inaccuracy
    tScore.earnedMarks = Math.round(tScore.earnedMarks * 10000) / 10000;
    
    // Percentage is 0 if totalMarks is 0 or if earnedMarks is negative
    const rawPct =
      tScore.totalMarks > 0
        ? (tScore.earnedMarks / tScore.totalMarks) * 100
        : 0;
    const pct = Math.max(0, Math.round(rawPct * 100) / 100);
    tScore.percentage = pct;

    topics[topicName] = tScore;
    topicPercentages[topicName] = pct;

    if (pct < 50) {
      weakTopics.push(topicName);
    }
  }

  // Precision rounding for total score
  const roundedRawScore = Math.round(rawScore * 10000) / 10000;
  const finalScore = allowNegative ? roundedRawScore : Math.max(0, roundedRawScore);
  const overallPercentage =
    maxPossibleScore > 0
      ? Math.max(0, Math.round(((finalScore / maxPossibleScore) * 100) * 100) / 100)
      : 0;

  return {
    totalScore: finalScore,
    rawScore: roundedRawScore,
    maxPossibleScore,
    percentage: overallPercentage,
    totalQuestions: questions.length,
    correctCount,
    wrongCount,
    skippedCount,
    questionResults,
    topics,
    topicPercentages,
    weakTopics,
  };
}

