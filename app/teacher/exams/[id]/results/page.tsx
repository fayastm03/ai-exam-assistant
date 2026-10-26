'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Users,
  Clock,
  TrendingUp,
  Award,
  AlertCircle,
  Loader2,
  Search,
  RotateCw,
  BarChart3,
  ListOrdered,
  FileSpreadsheet,
} from 'lucide-react';

interface StudentResultItem {
  attemptId: string;
  studentId: string;
  studentName: string;
  status: 'submitted' | 'auto_submitted';
  score: number;
  maxPossibleScore: number;
  percentage: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  startedAt: string;
  submittedAt: string;
  timeTakenSeconds: number;
  weakTopics: string[];
}

interface QuestionStatItem {
  questionId: string;
  number: number;
  text: string;
  marks: number;
  topic: string | null;
  correctOption: string;
  explanation: string | null;
  totalAttempts: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  accuracyPercentage: number;
}

interface TeacherExamResultsResponse {
  exam: {
    id: string;
    title: string;
    duration_min: number;
    negative_marking: number;
    status: string;
    maxPossibleScore: number;
    questionCount: number;
  };
  stats: {
    totalSubmissions: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    averagePercentage: number;
    averageTimeSeconds: number;
  };
  studentResults: StudentResultItem[];
  questionStats: QuestionStatItem[];
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
}

export default function TeacherExamResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: examId } = use(params);

  const [data, setData] = useState<TeacherExamResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'students' | 'accuracy'>('students');
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchResults = useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const res = await fetch(`/api/teacher/exams/${examId}/results`, {
          cache: 'no-store',
        });
        const json = await res.json();

        if (!ignore) {
          if (!res.ok) {
            throw new Error(json.message || 'Failed to fetch exam results');
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

    load();

    return () => {
      ignore = true;
    };
  }, [examId, refreshKey]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-neutral-500">Loading class results and accuracy stats...</p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-8">
        <Link
          href={`/teacher/exams/${examId}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs h-8')}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Exam Editor
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Error Loading Results</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {errorMsg || 'Unable to retrieve exam results'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { exam, stats, studentResults, questionStats } = data;

  const filteredStudents = studentResults.filter((s) =>
    s.studentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200/80 dark:border-neutral-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/teacher/exams/${examId}`}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'text-xs -ml-2 text-neutral-500 hover:text-neutral-900 h-7'
              )}
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back to Exam Editor
            </Link>
            <span className="text-neutral-300 dark:text-neutral-700">/</span>
            <span className="text-xs text-neutral-500 font-medium">Class Results</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              {exam.title}
            </h1>
            <Badge variant="outline" className="text-xs font-medium capitalize">
              {exam.status}
            </Badge>
          </div>

          <p className="text-xs text-neutral-500">
            {exam.questionCount} Questions • Duration: {exam.duration_min} mins • Max Score:{' '}
            {exam.maxPossibleScore}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchResults}
            className="text-xs"
            disabled={loading}
          >
            <RotateCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Aggregate Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-neutral-200/80 dark:border-neutral-800">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-neutral-500 font-medium">Submissions</span>
              <div className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                {stats.totalSubmissions}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 dark:border-neutral-800">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-neutral-500 font-medium">Class Average</span>
              <div className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                {stats.averageScore}
                <span className="text-xs font-normal text-neutral-400 ml-1">
                  / {exam.maxPossibleScore}
                </span>
              </div>
              <span className="text-[11px] text-emerald-600 font-medium">
                {stats.averagePercentage}% average
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 dark:border-neutral-800">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-neutral-500 font-medium">High / Low Score</span>
              <div className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                {stats.highestScore}
                <span className="text-sm font-normal text-neutral-400 mx-1">/</span>
                <span className="text-lg font-semibold text-neutral-500">{stats.lowestScore}</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 dark:border-neutral-800">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-neutral-500 font-medium">Average Time</span>
              <div className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                {formatDuration(stats.averageTimeSeconds)}
              </div>
              <span className="text-[11px] text-neutral-400">
                limit: {exam.duration_min} mins
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
        <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveView('students')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors',
              activeView === 'students'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            )}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            Student Submissions ({studentResults.length})
          </button>
          <button
            onClick={() => setActiveView('accuracy')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors',
              activeView === 'accuracy'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Per-Question Accuracy ({questionStats.length})
          </button>
        </div>

        {activeView === 'students' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
            <Input
              type="text"
              placeholder="Search student name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        )}
      </div>

      {/* Empty State when 0 Submissions */}
      {studentResults.length === 0 && (
        <Card className="border-dashed border-2 border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 text-center py-12">
          <CardContent className="space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <CardTitle className="text-base font-semibold">No Submissions Yet</CardTitle>
            <CardDescription className="text-xs text-neutral-500 max-w-sm mx-auto">
              Students have not submitted any attempts for this exam yet. Once students take the exam, their scores, time taken, and question accuracy will update here automatically.
            </CardDescription>
          </CardContent>
        </Card>
      )}

      {/* VIEW 1: Student Submissions Table */}
      {studentResults.length > 0 && activeView === 'students' && (
        <Card className="border-neutral-200/80 dark:border-neutral-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200/80 dark:border-neutral-800 text-neutral-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Student
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Score
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Percentage
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Breakdown
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Time Taken
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Submitted At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-neutral-500 text-xs">
                      No students matching &quot;{searchQuery}&quot; found.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr
                      key={s.attemptId}
                      className="hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100">
                        {s.studentName}
                      </td>

                      <td className="px-4 py-3 text-center font-bold text-neutral-900 dark:text-neutral-100">
                        {s.score}
                        <span className="text-neutral-400 font-normal text-[11px] ml-0.5">
                          / {s.maxPossibleScore}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[11px] font-bold py-0 h-5',
                            s.percentage >= 75
                              ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20'
                              : s.percentage >= 50
                                ? 'border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/20'
                                : 'border-red-300 text-red-700 bg-red-50 dark:bg-red-950/20'
                          )}
                        >
                          {s.percentage}%
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-center text-[11px]">
                        <span className="text-emerald-600 font-medium">✓ {s.correctCount}</span>
                        <span className="text-neutral-300 mx-1">•</span>
                        <span className="text-red-600 font-medium">✗ {s.wrongCount}</span>
                        <span className="text-neutral-300 mx-1">•</span>
                        <span className="text-neutral-500">− {s.skippedCount}</span>
                      </td>

                      <td className="px-4 py-3 text-center font-medium text-neutral-600 dark:text-neutral-300">
                        {formatDuration(s.timeTakenSeconds)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[11px] font-medium capitalize',
                            s.status === 'auto_submitted'
                              ? 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/20'
                              : 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20'
                          )}
                        >
                          {s.status === 'auto_submitted' ? 'Auto-Submitted' : 'Submitted'}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-right text-neutral-500 text-[11px]">
                        {new Date(s.submittedAt).toLocaleDateString()}{' '}
                        {new Date(s.submittedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* VIEW 2: Per-Question Class Accuracy */}
      {studentResults.length > 0 && activeView === 'accuracy' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              Shows what percentage of the class answered each question correctly. Questions with low accuracy (&lt; 50%) are highlighted.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {questionStats.map((q) => {
              const isLowAccuracy = q.accuracyPercentage < 50;

              return (
                <Card
                  key={q.questionId}
                  className={cn(
                    'border transition-colors',
                    isLowAccuracy
                      ? 'border-red-200/80 dark:border-red-900/50 bg-red-50/10 dark:bg-red-950/10'
                      : 'border-neutral-200/80 dark:border-neutral-800'
                  )}
                >
                  <CardHeader className="p-4 sm:p-5 pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                          Question {q.number}
                        </span>

                        {q.topic && (
                          <Badge variant="outline" className="text-[11px] py-0">
                            {q.topic}
                          </Badge>
                        )}

                        <span className="text-xs text-neutral-400">•</span>
                        <span className="text-xs text-neutral-500 font-medium">
                          {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                        </span>

                        <span className="text-xs text-neutral-400">•</span>
                        <span className="text-xs font-semibold text-emerald-600">
                          Correct: Option {q.correctOption}
                        </span>
                      </div>

                      {/* Class Accuracy Pill */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs font-bold px-2 py-0.5',
                            q.accuracyPercentage >= 75
                              ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20'
                              : q.accuracyPercentage >= 50
                                ? 'border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/20'
                                : 'border-red-300 text-red-700 bg-red-50 dark:bg-red-950/20'
                          )}
                        >
                          {q.accuracyPercentage}% Class Accuracy
                        </Badge>
                      </div>
                    </div>

                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 pt-2 whitespace-pre-wrap leading-relaxed">
                      {q.text}
                    </p>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
                    {/* Visual Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>Class Success Rate</span>
                        <span>
                          {q.correctCount} of {q.totalAttempts} students correct
                        </span>
                      </div>

                      <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-full transition-all"
                          style={{ width: `${q.accuracyPercentage}%` }}
                          title={`Correct: ${q.correctCount}`}
                        />
                        <div
                          className="bg-red-400 h-full transition-all"
                          style={{
                            width: `${q.totalAttempts > 0 ? (q.wrongCount / q.totalAttempts) * 100 : 0}%`,
                          }}
                          title={`Wrong: ${q.wrongCount}`}
                        />
                        <div
                          className="bg-neutral-300 dark:bg-neutral-700 h-full transition-all"
                          style={{
                            width: `${q.totalAttempts > 0 ? (q.skippedCount / q.totalAttempts) * 100 : 0}%`,
                          }}
                          title={`Skipped: ${q.skippedCount}`}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Correct: {q.correctCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-400" />
                            Wrong: {q.wrongCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                            Skipped: {q.skippedCount}
                          </span>
                        </div>

                        {isLowAccuracy && (
                          <span className="text-red-600 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Trouble Spot for Class
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
