'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Clock,
  HelpCircle,
  AlertCircle,
  Play,
  RotateCw,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  FileText,
  Users,
} from 'lucide-react';

interface ExamData {
  id: string;
  title: string;
  instructions: string | null;
  duration_min: number;
  open_at: string | null;
  close_at: string | null;
  negative_marking: number;
  shuffle: boolean;
  question_count: number;
}

interface AttemptData {
  id: string;
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  status: 'in_progress' | 'submitted' | 'auto_submitted';
  score: number | null;
}

export default function StudentExamInstructionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: examId } = use(params);
  const router = useRouter();

  const [exam, setExam] = useState<ExamData | null>(null);
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [membershipDeniedMsg, setMembershipDeniedMsg] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const res = await fetch(`/api/student/exams/${examId}`, { cache: 'no-store' });
        const data = await res.json();
        if (!ignore) {
          if (res.status === 403) {
            setMembershipDeniedMsg(
              data.message ||
                'Access denied: You must be an approved member of a class assigned to this exam.'
            );
            return;
          }
          if (!res.ok) throw new Error(data.message || 'Failed to load exam details');
          setExam(data.exam);
          setAttempt(data.attempt);
          setErrorMsg(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setErrorMsg(err instanceof Error ? err.message : 'Error loading exam');
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

  const handleStartExam = async () => {
    setStarting(true);
    setErrorMsg(null);
    setMembershipDeniedMsg(null);

    try {
      const res = await fetch(`/api/student/exams/${examId}/start`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.status === 403) {
        setMembershipDeniedMsg(
          data.message ||
            'Access denied: You must be an approved member of a class assigned to this exam. Your membership may have been removed or is pending approval.'
        );
        setStarting(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || 'Failed to start exam');
      }

      if (data.alreadySubmitted) {
        router.push(`/exams/${examId}/result`);
        return;
      }

      router.push(`/exams/${examId}/take`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error starting exam');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-neutral-500">Loading instructions...</p>
      </div>
    );
  }

  if (membershipDeniedMsg && !exam) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <Link
          href="/exams"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs h-8')}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Available Exams
        </Link>
        <Card className="border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <CardTitle className="text-base font-semibold">Class Membership Required</CardTitle>
            </div>
            <CardDescription className="text-xs text-amber-800/90 dark:text-amber-300/80 pt-1 leading-relaxed">
              {membershipDeniedMsg}
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Link
              href="/classes"
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                'w-full sm:w-auto text-xs bg-amber-600 hover:bg-amber-700 text-white'
              )}
            >
              <Users className="w-3.5 h-3.5 mr-1.5" />
              View My Classes
            </Link>
            <Link
              href="/exams"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'w-full sm:w-auto text-xs'
              )}
            >
              Back to Exams
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (errorMsg || !exam) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <Link
          href="/exams"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs h-8')}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Available Exams
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMsg || 'Exam not found or closed'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isSubmitted = attempt?.status === 'submitted' || attempt?.status === 'auto_submitted';
  const isInProgress = attempt?.status === 'in_progress';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/exams"
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs h-8 text-neutral-500 hover:text-neutral-900 -ml-2')}
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1" />
        Back to Exams
      </Link>

      <Card className="border-neutral-200/80 dark:border-neutral-800 shadow-md">
        <CardHeader className="space-y-2 border-b border-neutral-100 dark:border-neutral-800/80 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold">{exam.title}</CardTitle>
              <CardDescription className="text-xs pt-1">
                Please review all examination guidelines before proceeding.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 text-blue-600 border-blue-200 bg-blue-50/50">
              MCQ Exam
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
              <Clock className="w-4 h-4 text-amber-500" />
              <div>
                <p className="text-[10px] text-neutral-400 font-medium">Duration</p>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200">{exam.duration_min} Minutes</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
              <HelpCircle className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-[10px] text-neutral-400 font-medium">Questions</p>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200">{exam.question_count} MCQs</p>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-center gap-2 p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <div>
                <p className="text-[10px] text-neutral-400 font-medium">Negative Marking</p>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {exam.negative_marking > 0 ? `-${Math.round(exam.negative_marking * 100)}% Wrong` : 'None'}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5 text-sm">
          {/* Teacher Instructions */}
          {exam.instructions && (
            <div className="space-y-1.5 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800">
              <h3 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Teacher Instructions
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 whitespace-pre-line leading-relaxed">
                {exam.instructions}
              </p>
            </div>
          )}

          {/* Test Rules Checklist */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              Examination Policies & Technical Notice
            </h3>

            <ul className="space-y-2.5 text-xs text-neutral-600 dark:text-neutral-400">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  <strong>Server-Owned Timer:</strong> The countdown timer is authoritative and server-enforced.
                  Refreshing the page or switching devices will resume your session with the exact remaining time.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  <strong>Instant Answer Auto-Save:</strong> Each selected answer is transmitted to the server immediately.
                  You can change your answers anytime before the deadline.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  <strong>Automatic Submission:</strong> At 00:00, your exam is submitted automatically.
                  Warnings are displayed at 5 minutes and 1 minute.
                </span>
              </li>
            </ul>
          </div>

          {/* Membership Denied 403 Alert */}
          {membershipDeniedMsg && (
            <Alert className="border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 py-3">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1.5">
                <AlertTitle className="text-xs font-semibold">Class Membership Notice</AlertTitle>
                <AlertDescription className="text-xs">
                  {membershipDeniedMsg}
                </AlertDescription>
                <div className="pt-1">
                  <Link
                    href="/classes"
                    className="text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline inline-flex items-center"
                  >
                    <Users className="w-3 h-3 mr-1" />
                    Check My Classes status
                  </Link>
                </div>
              </div>
            </Alert>
          )}

          {/* Notice on already submitted */}
          {isSubmitted && (
            <Alert className="border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 py-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <AlertTitle className="text-xs font-semibold">Exam Already Submitted</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                You have already submitted this exam on{' '}
                {attempt?.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : 'earlier'}.
                Score achieved: <strong>{attempt?.score ?? 0} marks</strong>.
              </AlertDescription>
            </Alert>
          )}

          {isInProgress && (
            <Alert className="border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <AlertTitle className="text-xs font-semibold">Attempt In Progress</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                You have an active timer running for this exam. Click Resume to continue answering.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
          {isSubmitted ? (
            <Link
              href={`/exams/${exam.id}/result`}
              className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold')}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              View Exam Results
            </Link>
          ) : isInProgress ? (
            <Link
              href={`/exams/${exam.id}/take`}
              className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-md')}
            >
              <RotateCw className="w-4 h-4 mr-2" />
              Resume Exam
            </Link>
          ) : (
            <Button
              onClick={handleStartExam}
              disabled={starting}
              size="lg"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20"
            >
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Initializing Exam Session...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Exam Now
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

