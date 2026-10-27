'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  Clock,
  HelpCircle,
  AlertCircle,
  Play,
  RotateCw,
  CheckCircle2,
  Calendar,
  BookOpen,
  Users,
  PlusCircle,
  Lock,
} from 'lucide-react';
import { mapApiError } from '@/lib/messages';

interface ExamItem {
  id: string;
  title: string;
  instructions: string | null;
  duration_min: number;
  open_at: string | null;
  close_at: string | null;
  negative_marking: number;
  shuffle: boolean;
  question_count: number;
  class_name: string;
  class_names?: string[];
  timing_status: 'upcoming' | 'available' | 'closed' | 'completed';
  my_attempt: {
    id: string;
    started_at: string;
    deadline_at: string;
    submitted_at: string | null;
    status: 'in_progress' | 'submitted' | 'auto_submitted';
    score: number | null;
  } | null;
}

interface StudentClassItem {
  membership_id: string;
  class_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
}

export default function StudentExamsPage() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [approvedClassesCount, setApprovedClassesCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchExams = useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [examsRes, classesRes] = await Promise.all([
          fetch('/api/student/exams', { cache: 'no-store' }),
          fetch('/api/student/classes', { cache: 'no-store' }),
        ]);

        const examsData = await examsRes.json();
        const classesData = await classesRes.json();

        if (!ignore) {
          if (!examsRes.ok) {
            throw new Error(examsData.message || 'Failed to fetch exams');
          }

          setExams(examsData.exams || []);

          if (classesRes.ok && Array.isArray(classesData.classes)) {
            const approved = (classesData.classes as StudentClassItem[]).filter(
              (c) => c.status === 'approved'
            );
            setApprovedClassesCount(approved.length);
          } else {
            setApprovedClassesCount(0);
          }

          setErrorMsg(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setErrorMsg(mapApiError(err, 'Failed to load exams. Please try again.').message);
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
  }, [refreshKey]);

  // Group exams by timing status
  const availableExams = exams.filter((e) => e.timing_status === 'available');
  const upcomingExams = exams.filter((e) => e.timing_status === 'upcoming');
  const completedExams = exams.filter((e) => e.timing_status === 'completed');
  const closedExams = exams.filter((e) => e.timing_status === 'closed');

  const renderExamCard = (exam: ExamItem) => {
    const isCompleted = exam.timing_status === 'completed';
    const isUpcoming = exam.timing_status === 'upcoming';
    const isClosed = exam.timing_status === 'closed';
    const isAvailable = exam.timing_status === 'available';
    const isInProgress = exam.my_attempt?.status === 'in_progress';

    return (
      <Card
        key={exam.id}
        className="flex flex-col justify-between hover:shadow-md transition-shadow border-neutral-200/80 dark:border-neutral-800"
      >
        <CardHeader className="pb-3">
          {/* Class Name Badge */}
          {exam.class_name && (
            <div className="flex items-center gap-1.5 pb-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/60">
                <Users className="w-3 h-3" />
                {exam.class_name}
              </span>
            </div>
          )}

          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base font-semibold line-clamp-1 leading-snug">
              {exam.title}
            </CardTitle>

            {isCompleted ? (
              <Badge className="bg-emerald-600 text-white font-medium text-xs">
                Completed
              </Badge>
            ) : isInProgress ? (
              <Badge
                variant="outline"
                className="border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 text-xs font-medium animate-pulse"
              >
                In Progress
              </Badge>
            ) : isUpcoming ? (
              <Badge variant="outline" className="border-sky-400 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/20 text-xs font-medium">
                Upcoming
              </Badge>
            ) : isClosed ? (
              <Badge variant="outline" className="border-neutral-300 text-neutral-500 bg-neutral-100 dark:bg-neutral-800 text-xs font-medium">
                Closed
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs font-medium text-blue-600 border-blue-200 bg-blue-50/50">
                Available
              </Badge>
            )}
          </div>

          {exam.instructions && (
            <CardDescription className="text-xs line-clamp-2 pt-1">
              {exam.instructions}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
              <span>{exam.question_count} Questions</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>{exam.duration_min} mins</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
            {exam.negative_marking > 0 ? (
              <Badge variant="outline" className="border-red-300 text-red-600 dark:border-red-900 bg-red-50/50 py-0">
                -{Math.round(exam.negative_marking * 100)}% Wrong
              </Badge>
            ) : (
              <Badge variant="outline" className="text-neutral-500 py-0">
                No Negative Marking
              </Badge>
            )}

            {isCompleted && exam.my_attempt?.score !== null && (
              <Badge variant="secondary" className="font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40">
                Score: {exam.my_attempt?.score}
              </Badge>
            )}
          </div>

          {/* Schedule Window Details */}
          {isUpcoming && exam.open_at && (
            <div className="text-[11px] text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 p-2 rounded border border-sky-200 dark:border-sky-900/40 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Opens: {new Date(exam.open_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
          )}

          {isClosed && (
            <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 pt-1">
              <Lock className="w-3 h-3" />
              <span>{exam.close_at ? `Closed on ${new Date(exam.close_at).toLocaleDateString()}` : 'Exam closed'}</span>
            </div>
          )}

          {isAvailable && exam.close_at && (
            <div className="text-[11px] text-neutral-500 pt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Closes {new Date(exam.close_at).toLocaleDateString()}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-3 border-t border-neutral-100 dark:border-neutral-800/60">
          {isCompleted ? (
            <Link
              href={`/exams/${exam.id}/result`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full text-xs text-emerald-700')}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              View Exam Results
            </Link>
          ) : isInProgress ? (
            <Link
              href={`/exams/${exam.id}/take`}
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'w-full text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium')}
            >
              <RotateCw className="w-3.5 h-3.5 mr-1.5" />
              Resume Test
            </Link>
          ) : isAvailable ? (
            <Link
              href={`/exams/${exam.id}`}
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'w-full text-xs font-medium')}
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Start Exam
            </Link>
          ) : isUpcoming ? (
            <Button
              disabled
              variant="outline"
              size="sm"
              className="w-full text-xs text-neutral-400 cursor-not-allowed bg-neutral-50 dark:bg-neutral-900"
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              Opens {exam.open_at ? new Date(exam.open_at).toLocaleDateString() : 'soon'}
            </Button>
          ) : (
            <Button
              disabled
              variant="outline"
              size="sm"
              className="w-full text-xs text-neutral-400 cursor-not-allowed bg-neutral-50 dark:bg-neutral-900"
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              Exam Closed
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Student Exams
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Browse published exams from your approved classes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/join"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-xs')}
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Join Class
          </Link>
          <Button variant="ghost" size="sm" onClick={fetchExams} className="text-xs h-8">
            <RotateCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{errorMsg}</span>
            <Button size="sm" variant="outline" onClick={fetchExams} className="ml-4 h-7 text-xs">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3" />
                <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2" />
                <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State 1: Student has NO approved classes */}
      {!loading && !errorMsg && approvedClassesCount === 0 && (
        <Card className="border-dashed py-12 text-center bg-neutral-50/50 dark:bg-neutral-900/50">
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <Users className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1">
              <CardTitle className="text-lg">Join a class to access exams</CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                You are not currently enrolled in any approved classes. To view and take exams, please join a class using the 6-character code given by your teacher.
              </CardDescription>
            </div>
            <Link
              href="/join"
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white')}
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
              Join a Class with Code
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Empty State 2: Student has approved classes, but no published exams exist */}
      {!loading && !errorMsg && approvedClassesCount !== null && approvedClassesCount > 0 && exams.length === 0 && (
        <Card className="border-dashed py-12 text-center bg-neutral-50/50 dark:bg-neutral-900/50">
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center">
              <BookOpen className="w-7 h-7" />
            </div>
            <div className="max-w-sm space-y-1">
              <CardTitle className="text-lg">No active exams</CardTitle>
              <CardDescription className="text-xs">
                Your instructors have not published any exams for your classes yet. Check back soon!
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchExams} className="text-xs">
                <RotateCw className="w-3 h-3 mr-1.5" />
                Refresh
              </Button>
              <Link
                href="/classes"
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs')}
              >
                View My Classes
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grouped Exams List */}
      {!loading && exams.length > 0 && (
        <div className="space-y-10">
          {/* Section 1: Available Exams */}
          {availableExams.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800 pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    Available Exams
                  </h2>
                  <Badge className="bg-blue-600 text-white text-xs px-2 py-0.5">
                    {availableExams.length}
                  </Badge>
                </div>
                <span className="text-xs text-neutral-500">Ready to begin</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {availableExams.map(renderExamCard)}
              </div>
            </div>
          )}

          {/* Section 2: Upcoming Exams */}
          {upcomingExams.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800 pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    Upcoming Exams
                  </h2>
                  <Badge variant="outline" className="border-sky-300 text-sky-600 dark:border-sky-800 dark:text-sky-400 text-xs px-2 py-0.5">
                    {upcomingExams.length}
                  </Badge>
                </div>
                <span className="text-xs text-neutral-500">Scheduled for later</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {upcomingExams.map(renderExamCard)}
              </div>
            </div>
          )}

          {/* Section 3: Completed Exams */}
          {completedExams.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800 pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    Completed Exams
                  </h2>
                  <Badge variant="outline" className="border-emerald-300 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400 text-xs px-2 py-0.5">
                    {completedExams.length}
                  </Badge>
                </div>
                <span className="text-xs text-neutral-500">Submissions & scores</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {completedExams.map(renderExamCard)}
              </div>
            </div>
          )}

          {/* Section 4: Closed Exams */}
          {closedExams.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800 pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    Closed Exams
                  </h2>
                  <Badge variant="outline" className="border-neutral-300 text-neutral-500 text-xs px-2 py-0.5">
                    {closedExams.length}
                  </Badge>
                </div>
                <span className="text-xs text-neutral-500">Deadline passed</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {closedExams.map(renderExamCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
