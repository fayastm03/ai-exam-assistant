'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  ArrowLeft,
  Award,
  Sparkles,
  Clock,
  HelpCircle,
  AlertTriangle,
  Loader2,
  AlertCircle,
  BookOpen,
} from 'lucide-react';

interface QuestionReview {
  id: string;
  number: number;
  text: string;
  options: { id: string; text: string }[] | Record<string, string>;
  marks: number;
  topic: string | null;
  correct_option: string;
  explanation: string | null;
  chosen_option: string | null;
  status: 'correct' | 'wrong' | 'skipped';
  score_earned: number;
}

interface TopicStat {
  topic: string;
  totalMarks: number;
  earnedMarks: number;
  percentage: number;
  questionCount: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
}

interface StudentResultData {
  exam: {
    id: string;
    title: string;
    duration_min: number;
    negative_marking: number;
  };
  attempt: {
    id: string;
    started_at: string;
    submitted_at: string;
    status: 'submitted' | 'auto_submitted';
    time_taken_seconds: number;
  };
  score: {
    totalScore: number;
    maxPossibleScore: number;
    percentage: number;
    correctCount: number;
    wrongCount: number;
    skippedCount: number;
    totalQuestions: number;
  };
  topicPercentages: Record<string, number>;
  topics: Record<string, TopicStat>;
  weakTopics: string[];
  questions: QuestionReview[];
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
}

export default function StudentExamResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: examId } = use(params);

  const [data, setData] = useState<StudentResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong' | 'skipped'>('all');

  useEffect(() => {
    let ignore = false;

    async function fetchResult() {
      try {
        const res = await fetch(`/api/student/exams/${examId}/result`, {
          cache: 'no-store',
        });
        const json = await res.json();

        if (!ignore) {
          if (!res.ok) {
            throw new Error(json.message || 'Failed to load examination results');
          }
          setData(json);
          setErrorMsg(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setErrorMsg(err instanceof Error ? err.message : 'Error loading results');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchResult();

    return () => {
      ignore = true;
    };
  }, [examId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <div className="text-center">
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Evaluating results...
          </p>
          <p className="text-xs text-neutral-500">
            Retrieving verified marks, explanations, and topic breakdowns
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="max-w-md mx-auto space-y-4 py-8">
        <Link
          href="/exams"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs h-8')}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Available Exams
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Unable to Load Result</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {errorMsg || 'Results could not be found for this attempt.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { exam, attempt, score, topics, weakTopics, questions } = data;

  const filteredQuestions = questions.filter((q) => {
    if (filter === 'all') return true;
    return q.status === filter;
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200/80 dark:border-neutral-800 pb-5">
        <div className="space-y-1">
          <Link
            href="/exams"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'text-xs -ml-2 text-neutral-500 hover:text-neutral-900 mb-1 h-7'
            )}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to All Exams
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              {exam.title}
            </h1>
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-medium',
                attempt.status === 'auto_submitted'
                  ? 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/20'
                  : 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20'
              )}
            >
              {attempt.status === 'auto_submitted' ? 'Auto-Submitted (Timer)' : 'Submitted'}
            </Badge>
          </div>
          <p className="text-xs text-neutral-500">
            Completed on {new Date(attempt.submitted_at).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/exams"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-xs')}
          >
            Browse Other Exams
          </Link>
        </div>
      </div>

      {/* Main Score Overview Card */}
      <Card className="border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden bg-gradient-to-br from-white via-white to-blue-50/30 dark:from-neutral-900 dark:via-neutral-900 dark:to-blue-950/20">
        <CardContent className="p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Primary Score Dial */}
            <div className="md:col-span-5 flex flex-col items-center md:items-start text-center md:text-left border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 pb-6 md:pb-0 md:pr-8">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                <Award className="w-4 h-4 text-blue-600" />
                Final Examination Score
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-5xl sm:text-6xl font-black tracking-tight text-neutral-900 dark:text-neutral-50">
                  {score.totalScore}
                </span>
                <span className="text-xl sm:text-2xl font-medium text-neutral-400">
                  / {score.maxPossibleScore}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Badge
                  className={cn(
                    'text-xs font-semibold px-2.5 py-0.5',
                    score.percentage >= 75
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : score.percentage >= 50
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                  )}
                >
                  {score.percentage}% Overall
                </Badge>
                <span className="text-xs text-neutral-500">
                  {score.percentage >= 50 ? 'Passed Examination' : 'Needs Review'}
                </span>
              </div>
            </div>

            {/* Performance Breakdown Tiles */}
            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-center">
                <div className="flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-1">
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  <span className="text-xs font-semibold">Correct</span>
                </div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {score.correctCount}
                </div>
                <div className="text-[11px] text-emerald-600/80">
                  of {score.totalQuestions} questions
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-red-50/70 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 text-center">
                <div className="flex items-center justify-center text-red-600 dark:text-red-400 mb-1">
                  <XCircle className="w-4 h-4 mr-1" />
                  <span className="text-xs font-semibold">Wrong</span>
                </div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {score.wrongCount}
                </div>
                <div className="text-[11px] text-red-600/80">
                  {exam.negative_marking > 0
                    ? `-${Math.round(exam.negative_marking * 100)}% marks`
                    : '0 deduction'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-center">
                <div className="flex items-center justify-center text-neutral-600 dark:text-neutral-400 mb-1">
                  <MinusCircle className="w-4 h-4 mr-1" />
                  <span className="text-xs font-semibold">Skipped</span>
                </div>
                <div className="text-2xl font-bold text-neutral-700 dark:text-neutral-300">
                  {score.skippedCount}
                </div>
                <div className="text-[11px] text-neutral-500">0 penalty</div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-center">
                <div className="flex items-center justify-center text-blue-600 dark:text-blue-400 mb-1">
                  <Clock className="w-4 h-4 mr-1" />
                  <span className="text-xs font-semibold">Time</span>
                </div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {formatDuration(attempt.time_taken_seconds)}
                </div>
                <div className="text-[11px] text-blue-600/80">
                  limit: {exam.duration_min}m
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Topics Breakdown & Weak Topics Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Per-Topic Breakdown */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Per-Topic Mastery
            </h2>
            <span className="text-xs text-neutral-500">
              {Object.keys(topics).length} {Object.keys(topics).length === 1 ? 'Topic' : 'Topics'}
            </span>
          </div>

          <Card className="border-neutral-200/80 dark:border-neutral-800">
            <CardContent className="p-4 sm:p-5 space-y-4">
              {Object.keys(topics).length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-4">
                  No topic breakdown available for this exam.
                </p>
              ) : (
                Object.values(topics).map((t) => (
                  <div key={t.topic} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {t.topic}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500 text-[11px]">
                          {t.earnedMarks} / {t.totalMarks} marks
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[11px] font-bold py-0 h-5',
                            t.percentage >= 75
                              ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20'
                              : t.percentage >= 50
                                ? 'border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/20'
                                : 'border-red-300 text-red-700 bg-red-50 dark:bg-red-950/20'
                          )}
                        >
                          {t.percentage}%
                        </Badge>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          t.percentage >= 75
                            ? 'bg-emerald-500'
                            : t.percentage >= 50
                              ? 'bg-blue-500'
                              : 'bg-red-500'
                        )}
                        style={{ width: `${Math.max(0, Math.min(100, t.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Weak Topics List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Focus Areas (&lt; 50%)
            </h2>
            <Badge variant="outline" className="text-xs">
              {weakTopics.length} {weakTopics.length === 1 ? 'Topic' : 'Topics'}
            </Badge>
          </div>

          <Card
            className={cn(
              'border shadow-sm h-full flex flex-col justify-between',
              weakTopics.length > 0
                ? 'border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10'
                : 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10'
            )}
          >
            <CardContent className="p-4 sm:p-5 space-y-3">
              {weakTopics.length > 0 ? (
                <>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    You scored below 50% in the following areas. Spend extra time reviewing these concepts:
                  </p>
                  <ul className="space-y-2">
                    {weakTopics.map((topicName) => {
                      const topicData = topics[topicName];
                      return (
                        <li
                          key={topicName}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-red-200/80 dark:border-red-900/60 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                              {topicName}
                            </span>
                          </div>
                          {topicData && (
                            <Badge variant="destructive" className="text-[10px] py-0 h-4">
                              {topicData.percentage}%
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <div className="py-6 text-center space-y-2">
                  <div className="mx-auto w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    No Weak Topics Detected!
                  </h3>
                  <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                    You scored 50% or higher across all tested topics in this exam. Great work!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Question-by-Question Review */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
              Question-by-Question Review
            </h2>
            <p className="text-xs text-neutral-500">
              Inspect your answers against the correct options and official explanations.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg self-start sm:self-auto text-xs">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors',
                filter === 'all'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              )}
            >
              All ({questions.length})
            </button>
            <button
              onClick={() => setFilter('correct')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors',
                filter === 'correct'
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-emerald-600'
              )}
            >
              Correct ({score.correctCount})
            </button>
            <button
              onClick={() => setFilter('wrong')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors',
                filter === 'wrong'
                  ? 'bg-white dark:bg-neutral-900 text-red-600 dark:text-red-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-red-600'
              )}
            >
              Wrong ({score.wrongCount})
            </button>
            <button
              onClick={() => setFilter('skipped')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors',
                filter === 'skipped'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              )}
            >
              Skipped ({score.skippedCount})
            </button>
          </div>
        </div>

        {/* Question Cards List */}
        <div className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800">
              No questions found under the &quot;{filter}&quot; filter.
            </div>
          ) : (
            filteredQuestions.map((q) => {
              // Normalize options array
              const optionsList: { id: string; text: string }[] = Array.isArray(q.options)
                ? q.options
                : Object.entries(q.options || {}).map(([id, text]) => ({
                    id,
                    text: String(text),
                  }));

              const isCorrect = q.status === 'correct';
              const isWrong = q.status === 'wrong';
              const isSkipped = q.status === 'skipped';

              return (
                <Card
                  key={q.id}
                  className={cn(
                    'border transition-colors overflow-hidden',
                    isCorrect
                      ? 'border-emerald-200 dark:border-emerald-900/60'
                      : isWrong
                        ? 'border-red-200 dark:border-red-900/60'
                        : 'border-neutral-200/80 dark:border-neutral-800'
                  )}
                >
                  <CardHeader className="p-4 sm:p-5 pb-3 bg-neutral-50/50 dark:bg-neutral-900/40 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                          Question {q.number}
                        </span>

                        {q.topic && (
                          <Badge variant="outline" className="text-[11px] py-0 text-neutral-600">
                            {q.topic}
                          </Badge>
                        )}

                        <span className="text-xs text-neutral-400">•</span>
                        <span className="text-xs font-medium text-neutral-500">
                          {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                        </span>
                      </div>

                      {/* Question Status Pill */}
                      <div>
                        {isCorrect && (
                          <Badge className="bg-emerald-600 text-white font-medium text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Correct (+{q.score_earned})
                          </Badge>
                        )}
                        {isWrong && (
                          <Badge variant="destructive" className="font-medium text-xs flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            Incorrect ({q.score_earned})
                          </Badge>
                        )}
                        {isSkipped && (
                          <Badge variant="secondary" className="font-medium text-xs flex items-center gap-1">
                            <MinusCircle className="w-3.5 h-3.5" />
                            Skipped (0)
                          </Badge>
                        )}
                      </div>
                    </div>

                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 pt-2 whitespace-pre-wrap leading-relaxed">
                      {q.text}
                    </p>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 space-y-4">
                    {/* Options Grid */}
                    <div className="space-y-2">
                      {optionsList.map((opt) => {
                        const isStudentChoice =
                          q.chosen_option?.trim().toUpperCase() === opt.id.trim().toUpperCase();
                        const isTheCorrectOption =
                          q.correct_option?.trim().toUpperCase() === opt.id.trim().toUpperCase();

                        return (
                          <div
                            key={opt.id}
                            className={cn(
                              'flex items-start justify-between p-3 rounded-lg border text-xs sm:text-sm transition-colors',
                              // Student picked wrong option: highlight RED
                              isStudentChoice && !isTheCorrectOption &&
                                'border-red-400 bg-red-50/70 dark:bg-red-950/30 text-red-950 dark:text-red-200 font-medium',
                              // Correct option: highlight GREEN
                              isTheCorrectOption &&
                                'border-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 font-medium',
                              // Neutral option
                              !isStudentChoice && !isTheCorrectOption &&
                                'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                            )}
                          >
                            <div className="flex items-start gap-2.5">
                              <span
                                className={cn(
                                  'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold uppercase mt-0.5 shrink-0',
                                  isStudentChoice && !isTheCorrectOption &&
                                    'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-100',
                                  isTheCorrectOption &&
                                    'bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
                                  !isStudentChoice && !isTheCorrectOption &&
                                    'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                                )}
                              >
                                {opt.id}
                              </span>
                              <span className="leading-relaxed">{opt.text}</span>
                            </div>

                            {/* Label tags */}
                            <div className="shrink-0 ml-2">
                              {isStudentChoice && isTheCorrectOption && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">
                                  <CheckCircle2 className="w-3 h-3" /> Your Answer (Correct)
                                </span>
                              )}
                              {isStudentChoice && !isTheCorrectOption && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950 px-2 py-0.5 rounded">
                                  <XCircle className="w-3 h-3" /> Your Answer
                                </span>
                              )}
                              {!isStudentChoice && isTheCorrectOption && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">
                                  Correct Answer
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Official Explanation */}
                    {q.explanation && (
                      <div className="mt-3 p-3.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/50 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-blue-900 dark:text-blue-300 mb-1">
                          <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                          Explanation
                        </div>
                        <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                          {q.explanation}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
