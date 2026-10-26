'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  ArrowLeft,
  Award,
  Sparkles,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface ResultData {
  exam: {
    id: string;
    title: string;
    duration_min: number;
    negative_marking: number;
    question_count: number;
  };
  attempt: {
    id: string;
    started_at: string;
    deadline_at: string;
    submitted_at: string;
    status: 'submitted' | 'auto_submitted';
    score: number;
  };
}

export default function StudentExamResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: examId } = use(params);

  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const res = await fetch(`/api/student/exams/${examId}`, { cache: 'no-store' });
        const json = await res.json();
        if (!ignore) {
          if (!res.ok) throw new Error(json.message || 'Failed to fetch results');
          if (!json.attempt || (json.attempt.status !== 'submitted' && json.attempt.status !== 'auto_submitted')) {
            throw new Error('This exam attempt has not been submitted yet.');
          }
          setData({
            exam: json.exam,
            attempt: json.attempt,
          });
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
  }, [examId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-neutral-500">Loading exam results...</p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <Link
          href="/exams"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs h-8')}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Exams
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMsg || 'Results not available'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Link
        href="/exams"
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs h-8 text-neutral-500 hover:text-neutral-900 -ml-2')}
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1" />
        Back to Available Exams
      </Link>

      <Card className="border-neutral-200/80 dark:border-neutral-800 shadow-md text-center">
        <CardHeader className="pb-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-2 shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-bold">Exam Submitted Successfully</CardTitle>
          <CardDescription className="text-xs">
            {data.exam.title} • {data.attempt.status === 'auto_submitted' ? 'Auto-submitted at deadline' : 'Manual submission'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Score Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-b from-neutral-50 to-neutral-100/70 dark:from-neutral-900 dark:to-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 max-w-sm mx-auto">
            <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 font-medium mb-1">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Calculated MCQ Score</span>
            </div>
            <div className="text-4xl font-black text-neutral-900 dark:text-neutral-50 tracking-tight">
              {data.attempt.score}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              Code-evaluated according to exam scoring rules
            </div>
          </div>

          <div className="text-xs text-neutral-500 flex items-center justify-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Submitted on {new Date(data.attempt.submitted_at).toLocaleString()}
            </span>
          </div>

          {/* Phase 4 notice */}
          <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 text-left py-3">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <AlertTitle className="text-xs font-semibold">Detailed Explanations & AI Feedback</AlertTitle>
            <AlertDescription className="text-xs mt-0.5">
              Comprehensive question-by-question explanations and AI-assisted topic feedback will unlock
              in Phase 4 once reviewed and released by your teacher.
            </AlertDescription>
          </Alert>
        </CardContent>

        <CardFooter className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex justify-center">
          <Link
            href="/exams"
            className={cn(buttonVariants({ variant: 'default', size: 'default' }), 'w-full sm:w-auto')}
          >
            Return to Exam List
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
