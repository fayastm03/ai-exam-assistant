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
} from 'lucide-react';

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
  my_attempt: {
    id: string;
    started_at: string;
    deadline_at: string;
    submitted_at: string | null;
    status: 'in_progress' | 'submitted' | 'auto_submitted';
    score: number | null;
  } | null;
}

export default function StudentExamsPage() {
  const [exams, setExams] = useState<ExamItem[]>([]);
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
        const res = await fetch('/api/student/exams', { cache: 'no-store' });
        const data = await res.json();
        if (!ignore) {
          if (!res.ok) throw new Error(data.message || 'Failed to fetch exams');
          setExams(data.exams || []);
          setErrorMsg(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setErrorMsg(err instanceof Error ? err.message : 'Error loading exams');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          Available Exams
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Select an exam to review instructions and begin your session.
        </p>
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

      {!loading && !errorMsg && exams.length === 0 && (
        <Card className="border-dashed py-12 text-center bg-neutral-50/50 dark:bg-neutral-900/50">
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-7 h-7" />
            </div>
            <div className="max-w-sm space-y-1">
              <CardTitle className="text-lg">No active exams</CardTitle>
              <CardDescription className="text-xs">
                There are no published exams available at this time. Please check back later.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchExams}>
              Refresh List
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && exams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {exams.map((exam) => {
            const isCompleted =
              exam.my_attempt?.status === 'submitted' || exam.my_attempt?.status === 'auto_submitted';
            const isInProgress = exam.my_attempt?.status === 'in_progress';

            return (
              <Card
                key={exam.id}
                className="flex flex-col justify-between hover:shadow-md transition-shadow border-neutral-200/80 dark:border-neutral-800"
              >
                <CardHeader className="pb-3">
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
                    ) : (
                      <Badge variant="outline" className="text-xs font-medium text-blue-600 border-blue-200 bg-blue-50/50">
                        Open
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

                  {(exam.open_at || exam.close_at) && (
                    <div className="text-[11px] text-neutral-500 pt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {exam.close_at ? `Closes ${new Date(exam.close_at).toLocaleDateString()}` : 'Open enrollment'}
                      </span>
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
                  ) : (
                    <Link
                      href={`/exams/${exam.id}`}
                      className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'w-full text-xs font-medium')}
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5" />
                      View Instructions & Start
                    </Link>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
