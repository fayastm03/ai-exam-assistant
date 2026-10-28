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
  Maximize2,
  ShieldAlert,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
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

  // Unified Exam Security & Interruption Lockdown
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [securityModalReason, setSecurityModalReason] = useState<
    'back' | 'tab_switch' | 'desktop_switch' | 'fullscreen_exit'
  >('back');
  const [securityViolationCount, setSecurityViolationCount] = useState(0);
  const [autoSubmitReason, setAutoSubmitReason] = useState<'time_expired' | 'violations_exceeded'>('time_expired');

  const enterFullscreen = useCallback(() => {
    if (typeof document !== 'undefined') {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      }
    }
  }, []);

  const allowNavigationRef = useRef(false);

  // Online/Offline & Auto-Retry Status (Edge Case 28)
  const [isOnline, setIsOnline] = useState<boolean>(
    () => (typeof window !== 'undefined' ? navigator.onLine : true)
  );

  // Trigger Security Alert & Lock Screen (Auto-submits if violations exceed 3)
  const triggerSecurityAlert = useCallback(
    (reason: 'back' | 'tab_switch' | 'desktop_switch' | 'fullscreen_exit') => {
      if (allowNavigationRef.current) return;
      setSecurityViolationCount((prev) => {
        const next = prev + 1;
        if (next > 3) {
          // More than three violations: auto-submit immediately!
          setSecurityModalOpen(false);
          setAutoSubmitReason('violations_exceeded');
          handleSubmitExamRef.current?.(true);
          return next;
        }
        setSecurityModalReason(reason);
        setSecurityModalOpen(true);
        return next;
      });
    },
    []
  );

  // Fullscreen, Tab Switch, Desktop Switch, and Shortcut Protections
  useEffect(() => {
    // Attempt fullscreen immediately on mount
    enterFullscreen();

    const handleFullscreenChange = () => {
      const inFs = Boolean(document.fullscreenElement);
      setIsFullscreen(inFs);
      if (!inFs && !allowNavigationRef.current) {
        triggerSecurityAlert('fullscreen_exit');
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && !allowNavigationRef.current) {
        triggerSecurityAlert('tab_switch');
      }
    };

    // Detect switching desktops (Mission Control / 3-finger swipe) or switching active apps
    const handleWindowBlur = () => {
      if (!allowNavigationRef.current) {
        triggerSecurityAlert('desktop_switch');
      }
    };

    const handlePreventCopy = (e: Event) => {
      e.preventDefault();
      toast.error('Copying or pasting is disabled for exam integrity.');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // Block browser close/reload/tab/app shortcuts: Cmd/Ctrl + W, R, T, N, Q, M, C, V, U, P, S, A
      if (
        (e.ctrlKey || e.metaKey) &&
        ['w', 'r', 't', 'n', 'q', 'm', 'c', 'v', 'u', 'p', 's', 'a'].includes(key)
      ) {
        e.preventDefault();
        triggerSecurityAlert('tab_switch');
      }
      // Block F5 (Refresh) and F12 (DevTools)
      if (e.key === 'F5' || e.key === 'F12') {
        e.preventDefault();
        triggerSecurityAlert('tab_switch');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('copy', handlePreventCopy);
    document.addEventListener('cut', handlePreventCopy);
    document.addEventListener('paste', handlePreventCopy);
    window.addEventListener('keydown', handleKeyDown);

    // Initial check
    setIsFullscreen(Boolean(document.fullscreenElement));

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('copy', handlePreventCopy);
      document.removeEventListener('cut', handlePreventCopy);
      document.removeEventListener('paste', handlePreventCopy);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enterFullscreen, triggerSecurityAlert]);

  // Trap Browser Back Button and Window Unload (mounts immediately to prevent back navigation while in exam)
  useEffect(() => {
    allowNavigationRef.current = false;
    setSecurityModalOpen(false);

    // Push dummy state so browser back button triggers popstate without leaving
    try {
      window.history.pushState({ examTake: true }, '', window.location.href);
    } catch {
      // Ignore if pushState is restricted
    }

    const handlePopState = () => {
      if (allowNavigationRef.current) return;
      // Re-push state so user stays on page
      try {
        window.history.pushState({ examTake: true }, '', window.location.href);
      } catch {}
      triggerSecurityAlert('back');
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [triggerSecurityAlert]);

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
            if (typeof document !== 'undefined' && document.fullscreenElement) {
              document.exitFullscreen().catch(() => {});
            }
            allowNavigationRef.current = true;
            router.replace('/exams');
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

          // If resuming an exam that already has <= 5 min or <= 1 min left,
          // do not immediately show the popup alert on load.
          if (remSec <= 300) {
            warned5MinRef.current = true;
          }
          if (remSec <= 60) {
            warned1MinRef.current = true;
          }

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

        if (typeof document !== 'undefined' && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }

        allowNavigationRef.current = true;
        router.replace('/exams');
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
        if (typeof document !== 'undefined' && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }

        allowNavigationRef.current = true;
        router.replace('/exams');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [examId, router]);

  // Authoritative Countdown Clock Loop
  useEffect(() => {
    if (!attempt?.deadline_at) return;

    const deadlineMs = new Date(attempt.deadline_at).getTime();

    const timer = setInterval(() => {
      const correctedNow = Date.now() + clockSkewMs;
      const remMs = deadlineMs - correctedNow;
      const remSec = Math.max(0, Math.floor(remMs / 1000));

      setRemainingSeconds(remSec);

      // 5-minute warning check (300 seconds) - only triggers when crossing the boundary
      if (remSec <= 300 && remSec > 60 && !warned5MinRef.current) {
        warned5MinRef.current = true;
        setShow5MinWarning(true);
      }

      // 1-minute warning check (60 seconds) - only triggers when crossing the boundary
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
  }, [attempt?.deadline_at, clockSkewMs, handleSubmitExam]);

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
          if (typeof document !== 'undefined' && document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          allowNavigationRef.current = true;
          router.replace('/exams');
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
        <Button
          onClick={() => {
            allowNavigationRef.current = true;
            router.push('/exams');
          }}
          variant="outline"
          className="w-full"
        >
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
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="space-y-4 max-w-6xl mx-auto pb-12 select-none"
    >
      {/* Fullscreen Required Lock Screen */}
      {!isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center select-none">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl border border-border bg-card shadow-2xl space-y-5 animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Maximize2 className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Fullscreen Exam Mode Required
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                For exam integrity and distraction-free testing, this examination must be taken in full-screen mode with all other applications hidden.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                type="button"
                onClick={enterFullscreen}
                className="w-full h-11 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <Maximize2 className="w-4 h-4" />
                Enter Fullscreen to Continue
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleSubmitExam(false)}
                disabled={submittingManual}
                className="w-full h-10 text-xs font-semibold rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Submit & Finish Exam
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Submitting Full Screen Overlay */}
      {autoSubmitting && (
        <div className="fixed inset-0 z-50 bg-neutral-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
          <h2 className="text-xl font-bold">
            {autoSubmitReason === 'violations_exceeded'
              ? 'Security Limit Exceeded — Auto-Submitting Exam'
              : 'Time Expired — Submitting Exam'}
          </h2>
          <p className="text-sm text-neutral-300">
            {autoSubmitReason === 'violations_exceeded'
              ? 'More than 3 security violations detected. Submitting your current answers...'
              : 'Evaluating your answers, please wait...'}
          </p>
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
      <div className="sticky top-2 sm:top-4 z-30 bg-card/95 backdrop-blur-md border border-border rounded-lg p-3 sm:p-4 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => triggerSecurityAlert('back')}
            className="text-muted-foreground hover:text-foreground h-9 px-2 gap-1 rounded-lg text-xs shrink-0 cursor-pointer"
            title="Submit or Continue"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Exit / Submit</span>
          </Button>

          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-foreground line-clamp-1">
                {exam.title}
              </h1>
              <Badge variant="outline" className="text-[10px] py-0 h-4 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 gap-1 inline-flex items-center">
                <ShieldAlert className="w-3 h-3" />
                <span>Protected</span>
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Question {currentIndex + 1} of {questions.length}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobilePaletteOpen(true)}
            className="sm:hidden text-xs h-9 rounded-lg"
          >
            <LayoutGrid className="w-4 h-4 mr-1 text-primary" />
            Questions ({answeredCount}/{questions.length})
          </Button>
        </div>

        {/* Server Countdown Clock */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-mono font-bold text-base sm:text-lg border transition-colors ${
              (remainingSeconds ?? 999) <= 60
                ? 'bg-destructive/10 border-destructive/40 text-destructive'
                : (remainingSeconds ?? 999) <= 300
                ? 'bg-warning/10 border-warning/40 text-warning'
                : 'bg-secondary border-border text-foreground'
            }`}
          >
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          <Button
            size="sm"
            onClick={() => setConfirmSubmitOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs sm:text-sm h-9 px-3 rounded-lg cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Finish & Submit</span>
            <span className="sm:hidden">Submit</span>
          </Button>
        </div>
      </div>

      {/* Main Area: Question View & Question Palette */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Active Question */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="rounded-lg border border-border shadow-sm min-h-[420px] flex flex-col justify-between">
            <CardHeader className="pb-4 border-b border-border">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded">
                    Question {currentIndex + 1}
                  </span>
                  {currentQ.topic && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {currentQ.topic}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {currentQ.marks} {currentQ.marks === 1 ? 'mark' : 'marks'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Real-time Save Status Indicator */}
                  <div className="flex items-center text-xs">
                    {currentSaveStatus === 'saving' && (
                      <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                      </span>
                    )}
                    {currentSaveStatus === 'saved' && (
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                      </span>
                    )}
                    {currentSaveStatus === 'failed' && (
                      <button
                        onClick={() => saveAnswerToServer(currentQ.id, currentChosen || null)}
                        className="flex items-center gap-1.5 text-destructive text-xs hover:underline font-medium"
                        title="Retry saving answer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Save failed (Retry)
                      </button>
                    )}
                  </div>

                  {/* Flag for Review Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFlag(currentQ.id)}
                    className={`h-8 px-2.5 text-xs rounded-lg ${
                      isCurrentFlagged
                        ? 'text-amber-600 bg-amber-500/10 font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 mr-1.5 ${isCurrentFlagged ? 'fill-amber-600' : ''}`} />
                    <span className="hidden sm:inline">{isCurrentFlagged ? 'Flagged' : 'Flag'}</span>
                  </Button>
                </div>
              </div>

              <p className="text-lg font-medium text-foreground pt-4 whitespace-pre-line leading-relaxed">
                {currentQ.text}
              </p>
            </CardHeader>

            <CardContent className="py-5 space-y-3 flex-1">
              {currentSaveStatus === 'failed' && (
                <Alert variant="destructive" className="py-2.5 text-xs rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    Network issue. Your answer is kept on screen and will retry automatically.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                {currentOptions.map((opt) => {
                  const isSelected = currentChosen === opt.id;
                  return (
                    <label
                      key={opt.id}
                      onClick={() => handleSelectOption(currentQ.id, opt.id)}
                      className={`flex items-start gap-3.5 p-4 rounded-lg border text-base cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5 text-foreground font-medium ring-1 ring-primary'
                          : 'border-border hover:bg-secondary/40 text-foreground'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-option-${currentQ.id}`}
                        checked={isSelected}
                        onChange={() => handleSelectOption(currentQ.id, opt.id)}
                        className="mt-1 h-4 w-4 cursor-pointer accent-primary"
                      />
                      <span className="font-semibold text-muted-foreground shrink-0 w-5">{opt.id}.</span>
                      <span className="flex-1 leading-normal">{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            </CardContent>

            <CardFooter className="pt-4 border-t border-border flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="text-xs h-9 px-3 rounded-lg"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              <div className="text-xs text-muted-foreground">
                Question {currentIndex + 1} of {questions.length}
              </div>

              {currentIndex < questions.length - 1 ? (
                <Button
                  size="sm"
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="text-xs h-9 px-4 rounded-lg"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setConfirmSubmitOpen(true)}
                  className="text-xs h-9 px-4 rounded-lg bg-primary text-primary-foreground font-medium"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Review & Submit
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: Question Palette (Desktop) */}
        <div className="hidden lg:block space-y-4">
          <Card className="rounded-lg border border-border shadow-sm sticky top-36">
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Question Palette
              </CardTitle>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
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
                      className={`relative flex items-center justify-center h-9 rounded-lg font-semibold text-xs transition-colors ${
                        isCurrent ? 'ring-2 ring-primary ring-offset-1' : ''
                      } ${
                        hasAnswer
                          ? 'bg-emerald-600 text-white'
                          : isFlagged
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-400'
                          : 'bg-secondary text-secondary-foreground border border-border hover:bg-secondary/70'
                      }`}
                    >
                      {idx + 1}
                      {isFlagged && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-1 ring-background" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="space-y-2 pt-4 text-xs text-muted-foreground border-t border-border mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-emerald-600" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-400" />
                  <span>Flagged</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-secondary border border-border" />
                  <span>Unanswered</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile Question Palette Dialog */}
      <Dialog open={mobilePaletteOpen} onOpenChange={setMobilePaletteOpen}>
        <DialogContent className="max-w-sm rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Question Navigation</DialogTitle>
            <DialogDescription className="text-xs">
              Answered: {answeredCount} of {questions.length}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-5 gap-2.5 py-4 max-h-[340px] overflow-y-auto">
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
                  className={`relative flex items-center justify-center h-11 w-11 rounded-lg font-semibold text-sm transition-colors ${
                    isCurrent ? 'ring-2 ring-primary ring-offset-1' : ''
                  } ${
                    hasAnswer
                      ? 'bg-emerald-600 text-white'
                      : isFlagged
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-400'
                      : 'bg-secondary text-secondary-foreground border border-border'
                  }`}
                >
                  {idx + 1}
                  {isFlagged && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-1 ring-background" />
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* 5-Minute Warning Modal */}
      <Dialog open={show5MinWarning} onOpenChange={setShow5MinWarning}>
        <DialogContent className="max-w-sm rounded-lg">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-1">
              <Clock className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base text-foreground">5 minutes remaining</DialogTitle>
            <DialogDescription className="text-sm">
              You have 5 minutes left. Review any flagged questions before time runs out.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShow5MinWarning(false)} size="sm" className="rounded-lg h-9">
              Continue Answering
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1-Minute Warning Modal */}
      <Dialog open={show1MinWarning} onOpenChange={setShow1MinWarning}>
        <DialogContent className="max-w-sm rounded-lg">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-1">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base text-destructive">1 minute remaining</DialogTitle>
            <DialogDescription className="text-sm">
              Your exam will be automatically submitted as soon as the timer reaches 00:00.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShow1MinWarning(false)} size="sm" variant="destructive" className="rounded-lg h-9">
              I Understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Submit Dialog */}
      <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <DialogContent className="sm:max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Ready to submit?</DialogTitle>
            <DialogDescription className="text-sm">
              Once submitted, your answers will be marked and cannot be changed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-secondary rounded-lg">
                <div className="text-xl font-semibold text-foreground">{questions.length}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{answeredCount}</div>
                <div className="text-xs text-muted-foreground">Answered</div>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-lg">
                <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">{unansweredCount}</div>
                <div className="text-xs text-muted-foreground">Unanswered</div>
              </div>
            </div>

            {flaggedCount > 0 && (
              <Alert className="py-2.5 border-amber-400 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs rounded-lg">
                <Flag className="w-4 h-4 text-amber-600" />
                <AlertDescription>
                  You still have {flaggedCount} {flaggedCount === 1 ? 'question' : 'questions'} flagged for review.
                </AlertDescription>
              </Alert>
            )}

            {unansweredCount > 0 && (
              <p className="text-muted-foreground text-xs">
                Unanswered questions will receive 0 marks.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmSubmitOpen(false)}
              disabled={submittingManual}
              className="rounded-lg h-9"
            >
              Continue Test
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmitExam(false)}
              disabled={submittingManual}
              className="rounded-lg h-9 bg-primary text-primary-foreground font-medium"
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

      {/* Unified Exam Security Alert Dialog (Only 2 Options: Continue Exam OR Submit & Exit) */}
      <Dialog
        open={securityModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSecurityModalOpen(false);
            enterFullscreen();
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl" showCloseButton={false}>
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1 mx-auto sm:mx-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              {securityModalReason === 'back'
                ? 'Exam Interruption Attempted'
                : securityModalReason === 'tab_switch'
                ? 'Security Warning: Tab Switch Detected'
                : securityModalReason === 'desktop_switch'
                ? 'Security Warning: Desktop / Window Switched'
                : 'Security Warning: Fullscreen Mode Exited'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-1">
              {securityModalReason === 'back'
                ? 'Leaving or navigating away from the exam is not permitted. To preserve test integrity, you must either submit your exam or continue testing.'
                : `Leaving the exam screen, changing desktops, or opening another application is strictly prohibited (Security violations: ${securityViolationCount} of 3). You must either submit your exam now or continue testing.`}
            </DialogDescription>
          </DialogHeader>

          {/* Violation Strike Counter & Auto-Submit Hint */}
          <div
            className={cn(
              'p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2',
              securityViolationCount >= 3
                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
            )}
          >
            <div className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {securityViolationCount >= 3 ? (
                  <strong>Final Warning (Strike 3 of 3):</strong>
                ) : (
                  <strong>Strike {securityViolationCount} of 3:</strong>
                )}{' '}
                If you violate more than 3 times, your exam will automatically submit.
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {[1, 2, 3].map((step) => (
                <span
                  key={step}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    step <= securityViolationCount
                      ? securityViolationCount >= 3
                        ? 'bg-destructive'
                        : 'bg-amber-500'
                      : 'bg-muted-foreground/30'
                  )}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-2.5 bg-secondary rounded-lg">
                <div className="text-base font-semibold text-foreground">{questions.length}</div>
                <div className="text-[11px] text-muted-foreground">Total</div>
              </div>
              <div className="p-2.5 bg-emerald-500/10 rounded-lg">
                <div className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                  {answeredCount}
                </div>
                <div className="text-[11px] text-muted-foreground">Answered</div>
              </div>
              <div className="p-2.5 bg-amber-500/10 rounded-lg">
                <div className="text-base font-semibold text-amber-600 dark:text-amber-400">
                  {unansweredCount}
                </div>
                <div className="text-[11px] text-muted-foreground">Unanswered</div>
              </div>
            </div>

            {unansweredCount > 0 && (
              <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-400/40 p-2.5 rounded-lg">
                ⚠️ You have <strong>{unansweredCount} unanswered</strong> question{unansweredCount === 1 ? '' : 's'}. If you choose to submit now, unanswered questions will receive 0 marks.
              </p>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-col gap-2.5 pt-1">
            {/* Option 1: Continue Exam */}
            <Button
              type="button"
              onClick={() => {
                setSecurityModalOpen(false);
                enterFullscreen();
              }}
              className="w-full h-11 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              Continue Exam
            </Button>

            {/* Option 2: Submit & Exit Exam */}
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setSecurityModalOpen(false);
                handleSubmitExam(false);
              }}
              disabled={submittingManual}
              className="w-full h-10 text-xs font-semibold rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
            >
              {submittingManual ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting Exam...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit & Exit Exam</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
