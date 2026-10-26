import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { calculateScore, QuestionForScoring } from '@/lib/scoring';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/teacher/exams/[id]/results
 * Returns class-wide exam results for a teacher's exam:
 *  - Guarded: Only the teacher who owns the exam can access it.
 *  - Student attempts table: name, score, time taken, status.
 *  - Per-question accuracy for the whole class: percentage of students who got each question right.
 *  - All calculations sourced directly from saved attempt_answers and lib/scoring.ts.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  // 1. Fetch exam and verify ownership
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id, title, duration_min, negative_marking, status, open_at, close_at')
    .eq('id', examId)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found', 404);
  }

  if (exam.teacher_id !== auth.user.id) {
    return jsonError('Access denied: You can only view results for your own exams', 403);
  }

  // 2. Fetch all questions for this exam
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('id, number, text, options, marks, topic, correct_option, explanation')
    .eq('exam_id', examId)
    .order('number', { ascending: true });

  if (questionsError || !questions) {
    return jsonError('Failed to fetch exam questions', 500);
  }

  // Calculate maximum possible score across all questions
  const maxPossibleScore = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  // 3. Fetch all submitted or auto_submitted attempts with student profiles
  const { data: rawAttempts, error: attemptsError } = await supabase
    .from('attempts')
    .select(`
      id,
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
    .eq('exam_id', examId)
    .in('status', ['submitted', 'auto_submitted'])
    .order('submitted_at', { ascending: false });

  if (attemptsError) {
    return jsonError('Failed to fetch student attempts', 500);
  }

  // 3b. Optional class filter
  const { searchParams } = new URL(request.url);
  const classFilter = searchParams.get('class_id') || searchParams.get('classId');
  let attempts = rawAttempts || [];

  if (classFilter) {
    // Verify the class belongs to this teacher
    const { data: filterClass, error: fcError } = await supabase
      .from('classes')
      .select('id, name')
      .eq('id', classFilter)
      .eq('teacher_id', auth.user.id)
      .single();

    if (fcError || !filterClass) {
      return jsonError('Class filter invalid or you do not have permission to view it', 404);
    }

    // Fetch student IDs who are approved members of this class
    const { data: approvedMembers, error: memError } = await supabase
      .from('class_members')
      .select('student_id')
      .eq('class_id', classFilter)
      .eq('status', 'approved');

    if (memError) {
      return jsonError(memError.message, 500);
    }

    const approvedStudentIds = new Set((approvedMembers || []).map((m) => m.student_id));
    attempts = attempts.filter((att) => approvedStudentIds.has(att.student_id));
  }

  // If no attempts submitted yet, return empty list and 0-accuracy question list
  if (!attempts || attempts.length === 0) {
    const emptyQuestionStats = questions.map((q) => ({
      questionId: q.id,
      number: q.number,
      text: q.text,
      marks: q.marks,
      topic: q.topic,
      correctOption: q.correct_option,
      totalAttempts: 0,
      correctCount: 0,
      wrongCount: 0,
      skippedCount: 0,
      accuracyPercentage: 0,
    }));

    return jsonSuccess({
      exam: {
        id: exam.id,
        title: exam.title,
        duration_min: exam.duration_min,
        negative_marking: exam.negative_marking,
        status: exam.status,
        maxPossibleScore,
        questionCount: questions.length,
      },
      stats: {
        totalSubmissions: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        averagePercentage: 0,
        averageTimeSeconds: 0,
      },
      studentResults: [],
      questionStats: emptyQuestionStats,
    });
  }

  const attemptIds = attempts.map((a) => a.id);

  // 4. Fetch all attempt_answers for these attempts
  const { data: allAnswers, error: answersError } = await supabase
    .from('attempt_answers')
    .select('attempt_id, question_id, chosen_option, is_correct')
    .in('attempt_id', attemptIds);

  if (answersError) {
    return jsonError('Failed to fetch attempt answers', 500);
  }

  // Group answers by attempt_id
  const answersByAttempt: Record<string, Record<string, string | null>> = {};
  const answersByQuestion: Record<
    string,
    { chosenOption: string | null; isCorrect: boolean | null }[]
  > = {};

  // Initialize question answers bucket
  questions.forEach((q) => {
    answersByQuestion[q.id] = [];
  });

  (allAnswers || []).forEach((ans) => {
    if (!answersByAttempt[ans.attempt_id]) {
      answersByAttempt[ans.attempt_id] = {};
    }
    answersByAttempt[ans.attempt_id][ans.question_id] = ans.chosen_option;

    if (answersByQuestion[ans.question_id]) {
      answersByQuestion[ans.question_id].push({
        chosenOption: ans.chosen_option,
        isCorrect: ans.is_correct,
      });
    }
  });

  // 5. Calculate student results with pure scoring engine
  const studentResults = attempts.map((att) => {
    const studentAnswers = answersByAttempt[att.id] || {};
    
    // Calculate via lib/scoring.ts to guarantee pure scoring consistency
    const scoring = calculateScore(
      questions as QuestionForScoring[],
      studentAnswers,
      exam.negative_marking
    );

    let timeTakenSeconds = 0;
    if (att.started_at && att.submitted_at) {
      const startMs = new Date(att.started_at).getTime();
      const endMs = new Date(att.submitted_at).getTime();
      timeTakenSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
    }

    // Supabase foreign join typing
    type ProfileJoin = { id?: string; name?: string } | { id?: string; name?: string }[] | null;
    const profile = att.profiles as ProfileJoin;
    const studentName =
      (Array.isArray(profile) ? profile[0]?.name : profile?.name) || 'Anonymous Student';

    return {
      attemptId: att.id,
      studentId: att.student_id,
      studentName,
      status: att.status as 'submitted' | 'auto_submitted',
      score: scoring.totalScore,
      maxPossibleScore: scoring.maxPossibleScore,
      percentage: scoring.percentage,
      correctCount: scoring.correctCount,
      wrongCount: scoring.wrongCount,
      skippedCount: scoring.skippedCount,
      startedAt: att.started_at,
      submittedAt: att.submitted_at,
      timeTakenSeconds,
      weakTopics: scoring.weakTopics,
    };
  });

  // 6. Calculate per-question accuracy for the whole class
  const totalSubmissions = studentResults.length;

  const questionStats = questions.map((q) => {
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;

    studentResults.forEach((student) => {
      const chosen = answersByAttempt[student.attemptId]?.[q.id];
      if (!chosen || chosen.trim() === '') {
        skippedCount++;
      } else if (chosen.trim().toUpperCase() === q.correct_option.trim().toUpperCase()) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    const accuracyPercentage =
      totalSubmissions > 0 ? Math.round((correctCount / totalSubmissions) * 100) : 0;

    return {
      questionId: q.id,
      number: q.number,
      text: q.text,
      marks: q.marks,
      topic: q.topic,
      correctOption: q.correct_option,
      explanation: q.explanation,
      totalAttempts: totalSubmissions,
      correctCount,
      wrongCount,
      skippedCount,
      accuracyPercentage,
    };
  });

  // 7. Aggregate class statistics
  const totalScores = studentResults.map((s) => s.score);
  const totalPercentages = studentResults.map((s) => s.percentage);
  const totalTimes = studentResults.map((s) => s.timeTakenSeconds);

  const averageScore =
    totalScores.length > 0
      ? Number((totalScores.reduce((a, b) => a + b, 0) / totalScores.length).toFixed(2))
      : 0;

  const averagePercentage =
    totalPercentages.length > 0
      ? Math.round(totalPercentages.reduce((a, b) => a + b, 0) / totalPercentages.length)
      : 0;

  const averageTimeSeconds =
    totalTimes.length > 0
      ? Math.round(totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length)
      : 0;

  const highestScore = totalScores.length > 0 ? Math.max(...totalScores) : 0;
  const lowestScore = totalScores.length > 0 ? Math.min(...totalScores) : 0;

  return jsonSuccess({
    exam: {
      id: exam.id,
      title: exam.title,
      duration_min: exam.duration_min,
      negative_marking: exam.negative_marking,
      status: exam.status,
      maxPossibleScore,
      questionCount: questions.length,
    },
    stats: {
      totalSubmissions,
      averageScore,
      highestScore,
      lowestScore,
      averagePercentage,
      averageTimeSeconds,
    },
    studentResults,
    questionStats,
  });
}

