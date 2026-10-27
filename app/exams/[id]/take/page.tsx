'use client';

import React, { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Flag,
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  RefreshCw,
  AlertTriangle,
  LayoutGrid,
  WifiOff,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { mapApiError, MESSAGES } from '@/lib/messages';

interface QuestionItem {
  id: string;
  number: number;
  text: string;
  options: { id: string; text: string }[] | Record<string, string>;
  marks: number;
  topic: string | null;
}

interface AttemptData {
  id: string;
  exam_id: string;
  started_at: string;
  deadline_at: string;
  status: 'in_progress' | 'submitted' | 'auto_submitted';
}

interface ExamData {
  id: string;
  title: string;
  duration_min: number;
  negative_marking: number;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export default function StudentExamTakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: examId } = use(params);
  const router = useRouter();

  // Core Data
  const [exam, setExam] = useState<ExamData | null>(null);
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Student Interaction State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  // Clock & Skew Synchronization
  const [clockSkewMs, setClockSkewMs] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  // Time Warning Modals/Banners
  const [show5MinWarning, setShow5MinWarning] = useState(false);
  const [show1MinWarning, setShow1MinWarning] = useState(false);
  const warned5MinRef = useRef(false);
  const warned1MinRef = useRef(false);

  // Mobile Question Palette Drawer
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  // Online/Offline & Auto-Retry Status (Edge Case 28)
  const [isOnline, setIsOnline] = useState<boolean>(
    () => (typeof window !== 'undefined' ? navigator.onLine : true)
  );

  // Load Exam and Existing Attempt Session
  useEffect(() => {
    let ignore = false;

    async function loadAttempt() {
      try {
        const res = await fetch(`/api/student/exams/${examId}/attempt`, {
          cache: 'no-store',
        });
        const data = await res.json();

        if (!ignore) {
          if (!res.ok) {
            throw new Error(data.message || 'Failed to load exam session');
          }

          if (data.alreadySubmitted) {
            router.replace(`/exams/${examId}/result`);
            return;
          }

          setExam(data.exam);
          setAttempt(data.attempt);
          setQuestions(data.questions || []);
          setAnswers(data.answers || {});

          // Calculate server-browser clock skew: serverTime - browserTime
          const serverTimeMs = new Date(data.serverTime).getTime();
          const browserTimeMs = Date.now();
          const skew = serverTimeMs - browserTimeMs;
          setClockSkewMs(skew);

          // Initial remaining calculation
          const deadlineMs = new Date(data.attempt.deadline_at).getTime();
          const correctedNow = browserTimeMs + skew;
          const remSec = Math.max(0, Math.floor((deadlineMs - correctedNow) / 1000));
          setRemainingSeconds(remSec);

          setLoadError(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setLoadError(err instanceof Error ? err.message : 'Error loading exam session');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadAttempt();

    return () => {
      ignore = true;
    };
  }, [examId, router]);

  // Submit Exam Function (Handles Manual and Automatic Submit)
  const handleSubmitExamRef = useRef<(isAutoSubmit?: boolean) => Promise<void>>(undefined);

  const handleSubmitExam = useCallback(
    async (isAutoSubmit: boolean = false) => {
      if (isAutoSubmit) {
        setAutoSubmitting(true);
      } else {
        setSubmittingManual(true);
      }

      try {
        const res = await fetch(`/api/student/exams/${examId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoSubmitted: isAutoSubmit }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Failed to submit exam');
        }

        // Multi-tab sync: notify other open tabs to redirect to results
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`exam_submitted_${examId}`, String(Date.now()));
          } catch {
            // Ignore potential storage quota or private browsing exceptions
          }
        }

        router.replace(`/exams/${examId}/result`);
      } catch (err: unknown) {
        if (!isAutoSubmit) {
          toast.error(mapApiError(err, 'Failed to submit exam. Please try again.').message);
          setSubmittingManual(false);
        } else {
          // If auto-submit failed on network drop, retry in 3 seconds
          setTimeout(() => {
            handleSubmitExamRef.current?.(true);
          }, 3000);
        }
      }
    },
    [examId, router]
  );

  useEffect(() => {
    handleSubmitExamRef.current = handleSubmitExam;
  }, [handleSubmitExam]);

  // Synchronize submission across multiple open tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `exam_submitted_${examId}`) {
        router.replace(`/exams/${examId}/result`);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [examId, router]);

  // Authoritative Countdown Clock Loop
  useEffect(() => {
    if (!attempt?.deadline_at || remainingSeconds === null) return;

    const deadlineMs = new Date(attempt.deadline_at).getTime();

    const timer = setInterval(() => {
      const correctedNow = Date.now() + clockSkewMs;
      const remMs = deadlineMs - correctedNow;
      const remSec = Math.max(0, Math.floor(remMs / 1000));

      setRemainingSeconds(remSec);

      // 5-minute warning check (300 seconds)
      if (remSec <= 300 && remSec > 60 && !warned5MinRef.current) {
        warned5MinRef.current = true;
        setShow5MinWarning(true);
      }

      // 1-minute warning check (60 seconds)
      if (remSec <= 60 && remSec > 0 && !warned1MinRef.current) {
        warned1MinRef.current = true;
        setShow1MinWarning(true);
      }

      // Automatic submission at zero
      if (remSec <= 0) {
        clearInterval(timer);
        handleSubmitExam(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [attempt?.deadline_at, clockSkewMs, remainingSeconds, handleSubmitExam]);

  // Save Answer API Call with Retry Support
  const saveAnswerToServer = useCallback(
    async (questionId: string, chosenOption: string | null) => {
      setSaveStatuses((prev) => ({ ...prev, [questionId]: 'saving' }));

      try {
        const res = await fetch(`/api/student/exams/${examId}/answers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_id: questionId,
            chosen_option: chosenOption,
          }),
        });

        const data = await res.json();

        if (data.expired) {
          // Exam deadline has already passed on the server
          handleSubmitExam(true);
          return;
        }

        if (data.alreadySubmitted) {
          // Exam was submitted from another tab or window
          router.replace(`/exams/${examId}/result`);
          return;
        }

        if (!res.ok) {
          throw new Error(data.message || 'Failed to save');
        }

        setSaveStatuses((prev) => ({ ...prev, [questionId]: 'saved' }));
      } catch {
        // Mark as failed while preserving student answer on screen
        setSaveStatuses((prev) => ({ ...prev, [questionId]: 'failed' }));
      }
    },
    [examId, handleSubmitExam, router]
  );

  // Track browser online/offline status (Edge Case 28)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Edge Case 28: Keep retrying saves for any answers that failed during a network drop
  useEffect(() => {
    if (!isOnline) return;

    const failedQuestionIds = Object.entries(saveStatuses)
      .filter(([, status]) => status === 'failed')
      .map(([qId]) => qId);

    if (failedQuestionIds.length === 0) return;

    const retryTimer = setTimeout(() => {
      failedQuestionIds.forEach((qId) => {
        saveAnswerToServer(qId, answers[qId] ?? null);
      });
    }, 2500);

    return () => clearTimeout(retryTimer);
  }, [isOnline, saveStatuses, answers, saveAnswerToServer]);

  // Handle Option Selection
  const handleSelectOption = (questionId: string, optionId: string) => {
    // Immediate optimistic local update
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    // Save instantly to server
    saveAnswerToServer(questionId, optionId);
  };

  // Toggle Flag for Review
  const toggleFlag = (questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  // Format seconds to mm:ss
  const formatTimer = (seconds: number | null) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const normalizeOptions = (options: unknown): { id: string; text: string }[] => {
    if (Array.isArray(options)) {
      return options.map((opt) => ({
        id: String(opt.id || '').trim().toUpperCase(),
        text: String(opt.text || opt),
      }));
    }
    if (typeof options === 'object' && options !== null) {
      return Object.entries(options).map(([k, v]) => ({
        id: k.trim().toUpperCase(),
        text: String(v),
      }));
    }
    return [];
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-neutral-500">Connecting to exam session...</p>
      </div>
    );
  }

  if (loadError || !exam || questions.length === 0) {
    return (
      <div className="max-w-md mx-auto space-y-4 pt-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{loadError || 'Unable to start exam questions.'}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/exams')} variant="outline" className="w-full">
          Return to Exam List
        </Button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const currentOptions = normalizeOptions(currentQ.options);
  const currentChosen = answers[currentQ.id];
  const currentSaveStatus = saveStatuses[currentQ.id] || (currentChosen ? 'saved' : 'idle');
  const isCurrentFlagged = flagged.has(currentQ.id);

  // Statistics for palette and submit dialog
  const answeredCount = Object.values(answers).filter((a) => a !== null && a !== undefined && a !== '').length;
  const unansweredCount = questions.length - answeredCount;
  const flaggedCount = flagged.size;

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      {/* Auto-Submitting Full Screen Overlay */}
      {autoSubmitting && (
        <div className="fixed inset-0 z-50 bg-neutral-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
          <h2 className="text-xl font-bold">Time Expired — Submitting Exam</h2>
          <p className="text-sm text-neutral-300">Evaluating your answers, please wait...</p>
        </div>
      )}

      {/* Edge Case 28: Network Drop Warning Banner & Auto-Retry Indicator */}
      {(!isOnline || Object.values(saveStatuses).some((s) => s === 'failed')) && (
        <div className="bg-amber-600 text-white px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              {!isOnline
                ? MESSAGES.system.offline.message
                : 'Connection unstable. Retrying unsaved answers in the background...'}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-white text-amber-900 border-none hover:bg-neutral-100 shrink-0 ml-3 font-semibold"
            onClick={() => {
              Object.entries(saveStatuses)
                .filter(([, status]) => status === 'failed')
                .forEach(([qId]) => saveAnswerToServer(qId, answers[qId] ?? null));
            }}
          >
            Retry Now
          </Button>
        </div>
      )}

      {/* Top Test Header Bar */}
      <div className="sticky top-16 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3 sm:p-4 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 line-clamp-1">
              {exam.title}
            </h1>
            <p className="text-[11px] text-neutral-500">
              Question {currentIndex + 1} of {questions.length}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobilePaletteOpen(true)}
            className="sm:hidden text-xs h-8"
          >
            <LayoutGrid className="w-3.5 h-3.5 mr-1 text-blue-600" />
            Palette ({answeredCount}/{questions.length})
          </Button>
        </div>

        {/* Server Countdown Clock */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-sm sm:text-base border transition-colors ${
              (remainingSeconds ?? 999) <= 60
                ? 'bg-red-50 dark:bg-red-950/40 border-red-300 text-red-600 animate-pulse'
                : (remainingSeconds ?? 999) <= 300
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-700'
                : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200'
            }`}
          >
            <Clock className="w-4 h-4 text-neutral-500" />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          <Button
            size="sm"
            onClick={() => setConfirmSubmitOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-8 sm:h-9 shadow-sm"
          >
            <Send className="w-3.5 h-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Finish & Submit</span>
            <span className="sm:hidden">Submit</span>
          </Button>
        </div>
      </div>

      {/* Main Area: Question View & Question Palette */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left Column: Active Question (One at a time) */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-neutral-200/80 dark:border-neutral-800 shadow-sm min-h-[420px] flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800/80">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded">
                    Question #{currentIndex + 1}
                  </span>
                  {currentQ.topic && (
                    <Badge variant="secondary" className="text-[10px]">
                      {currentQ.topic}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] font-medium text-neutral-500">
                    {currentQ.marks} {currentQ.marks === 1 ? 'Mark' : 'Marks'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  {/* Real-time Save Status Indicator */}
                  <div className="flex items-center text-xs">
                    {currentSaveStatus === 'saving' && (
                      <span className="flex items-center gap-1 text-amber-600 text-[11px]">
                        <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                      </span>
                    )}
                    {currentSaveStatus === 'saved' && (
                      <span className="flex items-center gap-1 text-emerald-600 text-[11px]">
                        <CheckCircle2 className="w-3 h-3" /> Saved
                      </span>
                    )}
                    {currentSaveStatus === 'failed' && (
                      <button
                        onClick={() => saveAnswerToServer(currentQ.id, currentChosen || null)}
                        className="flex items-center gap-1 text-red-600 text-[11px] hover:underline"
                        title="Click to retry saving answer"
                      >
                        <RefreshCw className="w-3 h-3" /> Save failed (Retry)
                      </button>
                    )}
                  </div>

                  {/* Flag for Review Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFlag(currentQ.id)}
                    className={`h-7 px-2 text-xs ${
                      isCurrentFlagged
                        ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/30'
                        : 'text-neutral-400 hover:text-amber-600'
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 mr-1 ${isCurrentFlagged ? 'fill-amber-600' : ''}`} />
                    <span className="hidden sm:inline">{isCurrentFlagged ? 'Flagged' : 'Flag for Review'}</span>
                  </Button>
                </div>
              </div>

              <p className="text-base sm:text-lg font-medium text-neutral-900 dark:text-neutral-100 pt-3 whitespace-pre-line leading-relaxed">
                {currentQ.text}
              </p>
            </CardHeader>

            <CardContent className="py-4 space-y-2.5 flex-1">
              {currentSaveStatus === 'failed' && (
                <Alert variant="destructive" className="py-2 text-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <AlertDescription>
                    Network hiccup: your answer is retained on screen. Attempting to resave automatically...
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2.5">
                {currentOptions.map((opt) => {
                  const isSelected = currentChosen === opt.id;
                  return (
                    <label
                      key={opt.id}
                      onClick={() => handleSelectOption(currentQ.id, opt.id)}
                      className={`flex items-start gap-3.5 p-3.5 rounded-xl border text-sm cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-medium shadow-sm ring-1 ring-blue-500'
                          : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-option-${currentQ.id}`}
                        checked={isSelected}
                        onChange={() => handleSelectOption(currentQ.id, opt.id)}
                        className="text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5 cursor-pointer"
                      />
                      <span className="w-5 font-bold text-neutral-500 shrink-0">{opt.id}.</span>
                      <span className="flex-1 leading-snug">{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            </CardContent>

            <CardFooter className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="text-xs"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              <div className="text-xs text-neutral-400">
                Question {currentIndex + 1} of {questions.length}
              </div>

              {currentIndex < questions.length - 1 ? (
                <Button
                  size="sm"
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="text-xs"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setConfirmSubmitOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Review & Submit
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: Question Palette (Desktop) */}
        <div className="hidden lg:block space-y-4">
          <Card className="border-neutral-200/80 dark:border-neutral-800 sticky top-36">
            <CardHeader className="py-3 px-4 border-b border-neutral-100 dark:border-neutral-800/80">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                Question Palette
              </CardTitle>
              <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                <span>Answered: {answeredCount}/{questions.length}</span>
                {flaggedCount > 0 && <span className="text-amber-600 font-medium">{flaggedCount} Flagged</span>}
              </div>
            </CardHeader>

            <CardContent className="p-4">
              <div className="grid grid-cols-5 gap-2 max-h-[350px] overflow-y-auto p-0.5">
                {questions.map((q, idx) => {
                  const hasAnswer = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '';
                  const isFlagged = flagged.has(q.id);
                  const isCurrent = currentIndex === idx;

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`relative flex items-center justify-center h-8 rounded-lg font-bold text-xs transition-all ${
                        isCurrent ? 'ring-2 ring-blue-600 ring-offset-2' : ''
                      } ${
                        hasAnswer
                          ? 'bg-emerald-600 text-white'
                          : isFlagged
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      {idx + 1}
                      {isFlagged && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-1 ring-white" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="space-y-1.5 pt-4 text-[11px] text-neutral-500 border-t border-neutral-100 dark:border-neutral-800 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-emerald-600" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-amber-100 border border-amber-400" />
                  <span>Flagged for Review</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-neutral-100 border border-neutral-300" />
                  <span>Unanswered</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile Question Palette Dialog */}
      <Dialog open={mobilePaletteOpen} onOpenChange={setMobilePaletteOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Question Navigation</DialogTitle>
            <DialogDescription className="text-xs">
              Answered: {answeredCount} of {questions.length}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-5 gap-2 py-3 max-h-[300px] overflow-y-auto">
            {questions.map((q, idx) => {
              const hasAnswer = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '';
              const isFlagged = flagged.has(q.id);
              const isCurrent = currentIndex === idx;

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setMobilePaletteOpen(false);
                  }}
                  className={`relative flex items-center justify-center h-8 rounded-lg font-bold text-xs ${
                    isCurrent ? 'ring-2 ring-blue-600' : ''
                  } ${
                    hasAnswer
                      ? 'bg-emerald-600 text-white'
                      : isFlagged
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                  }`}
                >
                  {idx + 1}
                  {isFlagged && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-1 ring-white" />
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* 5-Minute Warning Modal */}
      <Dialog open={show5MinWarning} onOpenChange={setShow5MinWarning}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-1">
              <Clock className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base text-amber-700">5 Minutes Remaining</DialogTitle>
            <DialogDescription className="text-xs">
              You have 5 minutes left to complete your exam. Review flagged questions before time runs out.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShow5MinWarning(false)} size="sm">
              Continue Answering
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1-Minute Warning Modal */}
      <Dialog open={show1MinWarning} onOpenChange={setShow1MinWarning}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-1 animate-bounce">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base text-red-600">1 Minute Remaining!</DialogTitle>
            <DialogDescription className="text-xs">
              Your exam will be automatically submitted as soon as the timer reaches 00:00.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShow1MinWarning(false)} size="sm" variant="destructive">
              I Understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Submit Dialog */}
      <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Ready to Submit Exam?</DialogTitle>
            <DialogDescription className="text-xs">
              Once submitted, your answers will be graded and you will not be able to change them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg border">
                <div className="text-lg font-bold text-neutral-800 dark:text-neutral-100">{questions.length}</div>
                <div className="text-[10px] text-neutral-400">Total Questions</div>
              </div>
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-lg border border-emerald-200">
                <div className="text-lg font-bold text-emerald-700">{answeredCount}</div>
                <div className="text-[10px] text-emerald-600">Answered</div>
              </div>
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-lg border border-amber-200">
                <div className="text-lg font-bold text-amber-700">{unansweredCount}</div>
                <div className="text-[10px] text-amber-600">Unanswered</div>
              </div>
            </div>

            {flaggedCount > 0 && (
              <Alert className="py-2 border-amber-300 bg-amber-50/50 text-amber-800 text-xs">
                <Flag className="w-3.5 h-3.5 text-amber-600" />
                <AlertDescription>
                  You still have {flaggedCount} question{flaggedCount === 1 ? '' : 's'} flagged for review.
                </AlertDescription>
              </Alert>
            )}

            {unansweredCount > 0 && (
              <p className="text-neutral-500 text-[11px]">
                Note: Unanswered questions will receive 0 marks.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmSubmitOpen(false)}
              disabled={submittingManual}
            >
              Continue Test
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmitExam(false)}
              disabled={submittingManual}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {submittingManual ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Confirm & Submit'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
