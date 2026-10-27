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
  MessageSquare,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { AttemptFeedbackDialog } from '@/components/teacher/attempt-feedback-dialog';
import { mapApiError } from '@/lib/messages';

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
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Class filter state
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [assignedClasses, setAssignedClasses] = useState<{ id: string; name: string }[]>([]);

  // Fetch assigned classes for this exam to populate the class filter
  useEffect(() => {
    async function loadAssignedClasses() {
      try {
        const res = await fetch(`/api/teacher/exams/${examId}/classes`);
        const json = await res.json();
        if (res.ok && json.classes) {
          setAssignedClasses(json.classes);
        }
      } catch (err) {
        console.error('Failed to load assigned classes:', err);
      }
    }
    loadAssignedClasses();
  }, [examId]);

  const fetchResults = useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  // Bulk AI Feedback Generation states
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    processed: number;
    total: number;
    failed: number;
    message?: string;
  } | null>(null);
  const [bulkRateLimited, setBulkRateLimited] = useState(false);

  const handleBulkGenerateAiFeedback = async () => {
    setBulkGenerating(true);
    setBulkRateLimited(false);
    setBulkProgress(null);

    let totalDone = 0;
    let totalFailed = 0;

    try {
      while (true) {
        const res = await fetch(`/api/teacher/exams/${examId}/bulk-ai-feedback`, {
          method: 'POST',
        });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.message || 'Failed to generate bulk AI feedback');
        }

        totalDone += json.batchProcessed || 0;
        totalFailed += json.failedCount || 0;
        const totalEligible = (json.totalWithFeedback || 0) + (json.totalRemaining || 0);

        setBulkProgress({
          processed: json.totalWithFeedback || totalDone,
          total: totalEligible,
          failed: totalFailed,
          message: json.message,
        });

        if (json.rateLimited) {
          setBulkRateLimited(true);
          break;
        }

        if (json.done || json.totalRemaining === 0) {
          break;
        }
      }
    } catch (err: unknown) {
      setBulkProgress((prev) => ({
        processed: prev?.processed ?? totalDone,
        total: prev?.total ?? totalDone,
        failed: totalFailed,
        message: mapApiError(err, 'Could not generate bulk feedback. Please try again.').message,
      }));
    } finally {
      setBulkGenerating(false);
      fetchResults();
    }
  };

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const url =
          selectedClassId && selectedClassId !== 'all'
            ? `/api/teacher/exams/${examId}/results?class_id=${encodeURIComponent(selectedClassId)}`
            : `/api/teacher/exams/${examId}/results`;

        const res = await fetch(url, {
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
          setErrorMsg(mapApiError(err, 'Failed to load exam results. Please try again.').message);
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
  }, [examId, refreshKey, selectedClassId]);

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
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/teacher/exams/${examId}`}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'text-xs -ml-2 text-muted-foreground hover:text-foreground h-7'
              )}
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back to Exam
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-xs text-muted-foreground font-medium">Results</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {exam.title}
            </h1>
            <Badge variant="outline" className="text-xs font-normal capitalize rounded">
              {exam.status}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground">
            {exam.questionCount} {exam.questionCount === 1 ? 'question' : 'questions'} • Duration: {exam.duration_min} mins • Max marks: {exam.maxPossibleScore}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Class Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="class-filter-select" className="text-xs text-muted-foreground font-medium whitespace-nowrap">
              Class:
            </label>
            <select
              id="class-filter-select"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="h-9 px-3 text-xs font-medium rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[180px] sm:max-w-[220px]"
            >
              <option value="all">All Assigned Classes</option>
              {assignedClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkGenerateAiFeedback}
            disabled={bulkGenerating || loading || stats.totalSubmissions === 0}
            className="text-xs h-9 rounded-lg"
            title="Generate student feedback for all submitted attempts"
          >
            {bulkGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                {bulkProgress ? `${bulkProgress.processed}/${bulkProgress.total} done` : 'Generating...'}
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />
                Generate AI feedback for all students
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchResults}
            className="text-xs h-9 rounded-lg"
            disabled={loading || bulkGenerating}
          >
            <RotateCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Bulk AI Feedback Progress / Rate Limit Banners */}
      {bulkRateLimited && (
        <Alert variant="destructive" className="rounded-lg text-xs">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">Rate limit reached</AlertTitle>
          <AlertDescription>
            Rate limit reached, try again in a minute. ({bulkProgress?.processed ?? 0} generated so far).
          </AlertDescription>
        </Alert>
      )}

      {bulkProgress && !bulkRateLimited && (
        <Alert className="border-border bg-secondary text-foreground rounded-lg text-xs">
          <Sparkles className="h-4 w-4 text-primary" />
          <AlertTitle className="text-xs font-semibold">
            {bulkGenerating ? 'Generating Automated AI Feedback' : 'Bulk AI Feedback Status'}
          </AlertTitle>
          <AlertDescription>
            {bulkProgress.processed} of {bulkProgress.total} done
            {bulkProgress.failed > 0 && ` (${bulkProgress.failed} failed/skipped)`}.
            {bulkProgress.message && ` ${bulkProgress.message}.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Aggregate Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-lg border border-border shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Submissions</span>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {stats.totalSubmissions}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary text-primary flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-border shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Class Average</span>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {stats.averageScore}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  / {exam.maxPossibleScore}
                </span>
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {stats.averagePercentage}% average
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-border shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">High / Low Score</span>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {stats.highestScore}
                <span className="text-sm font-normal text-muted-foreground mx-1">/</span>
                <span className="text-lg font-semibold text-muted-foreground">{stats.lowestScore}</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary text-primary flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-border shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Average Time</span>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {formatDuration(stats.averageTimeSeconds)}
              </div>
              <span className="text-xs text-muted-foreground">
                limit: {exam.duration_min} mins
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center">
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
        <Card className="border-dashed border border-border bg-card text-center py-12 rounded-lg shadow-sm">
          <CardContent className="space-y-3">
            <div className="mx-auto w-12 h-12 rounded-lg bg-secondary text-primary flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <CardTitle className="text-base font-semibold text-foreground">No submissions yet</CardTitle>
            <CardDescription className="text-xs text-muted-foreground max-w-sm mx-auto">
              Students have not submitted any attempts for this exam yet. Results will appear here once attempts are completed.
            </CardDescription>
          </CardContent>
        </Card>
      )}

      {/* VIEW 1: Student Submissions Table */}
      {studentResults.length > 0 && activeView === 'students' && (
        <Card className="border border-border overflow-hidden rounded-lg shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-secondary border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
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
                  <th scope="col" className="px-4 py-3 text-center">
                    Submitted At
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Feedback
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-xs">
                      No students matching &quot;{searchQuery}&quot; found.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr
                      key={s.attemptId}
                      onClick={() => setSelectedAttemptId(s.attemptId)}
                      className="hover:bg-secondary/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        {s.studentName}
                      </td>

                      <td className="px-4 py-3.5 text-center font-bold text-foreground">
                        {s.score}
                        <span className="text-muted-foreground font-normal text-xs ml-0.5">
                          / {s.maxPossibleScore}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs font-semibold py-0 h-5 rounded',
                            s.percentage >= 75
                              ? 'border-emerald-400 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                              : s.percentage >= 50
                                ? 'border-primary/40 text-primary bg-primary/5'
                                : 'border-destructive/40 text-destructive bg-destructive/10'
                          )}
                        >
                          {s.percentage}%
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5 text-center text-xs">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ {s.correctCount}</span>
                        <span className="text-muted-foreground/40 mx-1">•</span>
                        <span className="text-destructive font-medium">✗ {s.wrongCount}</span>
                        <span className="text-muted-foreground/40 mx-1">•</span>
                        <span className="text-muted-foreground">− {s.skippedCount}</span>
                      </td>

                      <td className="px-4 py-3.5 text-center font-medium text-muted-foreground">
                        {formatDuration(s.timeTakenSeconds)}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs font-normal capitalize rounded',
                            s.status === 'auto_submitted'
                              ? 'border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-500/10'
                              : 'border-emerald-400 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                          )}
                        >
                          {s.status === 'auto_submitted' ? 'Auto-Submitted' : 'Submitted'}
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5 text-center text-muted-foreground text-xs">
                        {new Date(s.submittedAt).toLocaleDateString()}{' '}
                        {new Date(s.submittedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAttemptId(s.attemptId);
                          }}
                          className="h-8 text-xs rounded-lg"
                        >
                          <MessageSquare className="w-3.5 h-3.5 mr-1 text-primary" />
                          Feedback
                        </Button>
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

      {/* Student Attempt Review & Feedback Dialog */}
      <AttemptFeedbackDialog
        key={selectedAttemptId || 'none'}
        attemptId={selectedAttemptId}
        open={Boolean(selectedAttemptId)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedAttemptId(null);
        }}
        onFeedbackSaved={fetchResults}
      />
    </div>
  );
}
