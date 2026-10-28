'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppMessage } from '@/components/ui/app-message';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Clock,
  HelpCircle,
  Play,
  RotateCw,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  FileText,
  Users,
} from 'lucide-react';
import { mapApiError, MESSAGES } from '@/lib/messages';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface ExamData {
  id: string;
  title: string;
  instructions: string | null;
  duration_min: number;
  open_at: string | null;
  close_at: string | null;
  negative_marking: number;
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

export default function ExamInstructionsPage({
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
  const [confirmStartOpen, setConfirmStartOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const res = await fetch(`/api/student/exams/${examId}`);
        const data = await res.json();

        if (!ignore) {
          if (res.status === 403) {
            setMembershipDeniedMsg(
              data.message || MESSAGES.exams.noPermission.message
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
          setErrorMsg(mapApiError(err, 'Failed to load exam details.').message);
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
    // Request fullscreen during user gesture
    if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

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
          data.message || MESSAGES.exams.noPermission.message
        );
        setStarting(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || 'Failed to start exam');
      }

      if (data.alreadySubmitted) {
        setConfirmStartOpen(false);
        router.push(`/exams/${examId}/result`);
        return;
      }

      setConfirmStartOpen(false);
      router.push(`/exams/${examId}/take`);
    } catch (err: unknown) {
      setErrorMsg(mapApiError(err, 'Unable to begin exam session. Please try again.').message);
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-2 text-muted-foreground text-sm">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p>Loading exam instructions...</p>
      </div>
    );
  }

  if (membershipDeniedMsg && !exam) {
    return (
      <div className="max-w-md mx-auto space-y-4 p-4">
        <Link
          href="/exams"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to exams
        </Link>
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-5 space-y-3">
          <h2 className="text-base font-semibold text-foreground">Class Membership Required</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {membershipDeniedMsg}
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <Link
              href="/classes"
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'h-8 text-xs rounded-lg')}
            >
              <Users className="w-3.5 h-3.5 mr-1.5" />
              View My Classes
            </Link>
            <Link
              href="/exams"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 text-xs rounded-lg')}
            >
              Back to Exams
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg || !exam) {
    return (
      <div className="max-w-md mx-auto space-y-4 p-4">
        <Link
          href="/exams"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to exams
        </Link>
        <AppMessage message={errorMsg || 'Exam not found or closed.'} type="error" />
      </div>
    );
  }

  const isSubmitted = attempt?.status === 'submitted' || attempt?.status === 'auto_submitted';
  const isInProgress = attempt?.status === 'in_progress';

  return (
    <div className="max-w-xl mx-auto space-y-6 p-4 sm:p-6">
      <Link
        href="/exams"
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to exams
      </Link>

      <Card className="rounded-lg border border-border shadow-sm bg-card">
        <CardHeader className="p-6 border-b border-border space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {exam.title}
              </h1>
              <p className="text-xs text-muted-foreground">
                Review these guidelines before starting your attempt.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-medium border-border text-muted-foreground rounded-lg">
              Multiple Choice
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-2">
            <div className="p-3 rounded-lg bg-secondary text-left space-y-0.5">
              <p className="text-[11px] text-muted-foreground">Duration</p>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-primary" />
                {exam.duration_min} min
              </p>
            </div>
            <div className="p-3 rounded-lg bg-secondary text-left space-y-0.5">
              <p className="text-[11px] text-muted-foreground">Questions</p>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-primary" />
                {exam.question_count}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-secondary text-left space-y-0.5">
              <p className="text-[11px] text-muted-foreground">Marking</p>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                {exam.negative_marking > 0 ? `-${Math.round(exam.negative_marking * 100)}%` : 'No penalty'}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-5 text-sm">
          {exam.instructions && (
            <div className="p-3.5 rounded-lg border border-border bg-muted/40 space-y-1.5">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Teacher Instructions
              </p>
              <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                {exam.instructions}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Examination Policies
            </h2>

            <ol className="space-y-3 text-xs text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-secondary text-foreground flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  <strong>Server-timed:</strong> The clock runs continuously on the server. If you disconnect or close the tab, your remaining time continues counting down.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-secondary text-foreground flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  <strong>Automatic saving:</strong> Every answer is saved immediately to the server. You can change your choice at any point until time expires.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-secondary text-foreground flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  <strong>Auto-submit on deadline:</strong> When the timer reaches 00:00, your exam submits automatically with your saved answers.
                </span>
              </li>
            </ol>
          </div>
        </CardContent>

        <CardFooter className="p-6 pt-3 border-t border-border flex flex-col gap-2">
          {isSubmitted ? (
            <Link
              href={`/exams/${exam.id}/result`}
              className={cn(
                buttonVariants({ variant: 'default' }),
                'w-full h-10 text-base font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground'
              )}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              View Exam Results
            </Link>
          ) : isInProgress ? (
            <Button
              onClick={handleStartExam}
              disabled={starting}
              className="w-full h-10 text-base font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            >
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <RotateCw className="w-4 h-4 mr-2" />
                  Resume Exam Attempt
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => setConfirmStartOpen(true)}
              disabled={starting}
              className="w-full h-10 text-base font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            >
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting Exam...
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

      {/* Confirmation Dialog before Starting Exam */}
      <ConfirmDialog
        open={confirmStartOpen}
        onOpenChange={setConfirmStartOpen}
        title="Start this exam now?"
        description={
          exam ? (
            <>
              Once you start, your <strong>{exam.duration_min}-minute</strong> countdown timer begins immediately and cannot be paused.
            </>
          ) : (
            'Once you start, your countdown timer begins immediately and cannot be paused.'
          )
        }
        confirmText="Yes, Start Exam"
        cancelText="Cancel"
        variant="default"
        isLoading={starting}
        onConfirm={handleStartExam}
      />
    </div>
  );
}
