'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  Award,
  AlertTriangle,
  Loader2,
  AlertCircle,
  Send,
  Save,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  HelpCircle,
} from 'lucide-react';
import { mapApiError, MESSAGES } from '@/lib/messages';

interface AttemptFeedbackData {
  exam: {
    id: string;
    title: string;
    duration_min: number;
    negative_marking: number;
    status: string;
  };
  attempt: {
    id: string;
    student_id: string;
    student_name: string;
    started_at: string;
    submitted_at: string;
    status: 'submitted' | 'auto_submitted';
    time_taken_seconds: number;
    score: number;
    max_possible_score: number;
    percentage: number;
    correct_count: number;
    wrong_count: number;
    skipped_count: number;
    weak_topics: string[];
  };
  feedback: {
    overall: {
      id: string;
      comment: string;
      released: boolean;
      source?: string;
      updated_at: string;
    } | null;
    aiAuto?: {
      id: string;
      comment: string;
      released: boolean;
      source: 'ai_auto' | 'auto_template';
      updated_at: string;
    } | null;
    byQuestion: Record<
      string,
      { id: string; comment: string; released: boolean; source?: string; updated_at: string }
    >;
  };
  questions: {
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
    feedback: {
      id: string;
      comment: string;
      released: boolean;
      updated_at: string;
    } | null;
  }[];
}

interface AttemptFeedbackDialogProps {
  attemptId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFeedbackSaved?: () => void;
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
}

export function AttemptFeedbackDialog({
  attemptId,
  open,
  onOpenChange,
  onFeedbackSaved,
}: AttemptFeedbackDialogProps) {
  const [data, setData] = useState<AttemptFeedbackData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active view tab inside dialog: 'feedback' (default) or 'questions'
  const [activeTab, setActiveTab] = useState<'feedback' | 'questions'>('feedback');
  const [questionFilter, setQuestionFilter] = useState<'all' | 'wrong' | 'correct' | 'skipped'>('all');

  // Form states
  const [overallComment, setOverallComment] = useState('');
  const [questionComments, setQuestionComments] = useState<Record<string, string>>({});

  // AI Suggestion states
  const [suggesting, setSuggesting] = useState(false);
  const [aiDraftPending, setAiDraftPending] = useState(false);

  // Student Automated AI Feedback management states
  const [togglingAiVisibility, setTogglingAiVisibility] = useState(false);
  const [regeneratingAiFeedback, setRegeneratingAiFeedback] = useState(false);

  useEffect(() => {
    if (!open || !attemptId) return;

    let ignore = false;

    async function loadAttempt() {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      setAiDraftPending(false);
      setActiveTab('feedback');
      setQuestionFilter('all');

      try {
        const res = await fetch(`/api/teacher/attempts/${attemptId}`, {
          cache: 'no-store',
        });
        const json = await res.json();

        if (!ignore) {
          if (!res.ok) {
            throw new Error(json.message || 'Failed to load attempt details');
          }
          setData(json);
          // Only populate if teacher has not typed or received a suggestion
          setOverallComment((prev) =>
            prev && prev.trim().length > 0 ? prev : json.feedback?.overall?.comment || ''
          );

          const qComments: Record<string, string> = {};
          if (json.feedback?.byQuestion) {
            Object.entries(
              json.feedback.byQuestion as Record<string, { comment: string }>
            ).forEach(([qId, val]) => {
              qComments[qId] = val.comment || '';
            });
          }
          setQuestionComments(qComments);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setErrorMsg(err instanceof Error ? err.message : 'Error loading attempt');
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
  }, [open, attemptId]);

  const handleSuggestFeedback = async () => {
    if (!attemptId) return;
    setSuggesting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/teacher/attempts/${attemptId}/suggest-feedback`, {
        method: 'POST',
      });
      const json = await res.json();

      if (res.status === 429) {
        throw new Error(
          'AI rate limit reached. The AI provider is busy. Please wait a moment and try again.'
        );
      }

      if (!res.ok) {
        throw new Error(json.message || 'Failed to generate feedback suggestion');
      }

      const suggestedText =
        typeof json.feedback === 'string' ? json.feedback.trim() : json.data?.feedback || '';
      if (!suggestedText) {
        throw new Error('AI returned an empty feedback suggestion');
      }
      setOverallComment(suggestedText);
      setAiDraftPending(true);
      setSuccessMsg('AI draft feedback suggested. Review and edit before releasing.');
    } catch (err: unknown) {
      setErrorMsg(
        mapApiError(
          err,
          'The AI service is temporarily busy. Your exam and marking are not affected. Please try again in a minute.'
        ).message
      );
    } finally {
      setSuggesting(false);
    }
  };

  const handleSave = async (released: boolean) => {
    if (!attemptId) return;

    if (overallComment.length > 1000) {
      setErrorMsg('Overall comment exceeds 1000 characters limit');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const qCommentPayload = Object.entries(questionComments).map(([questionId, comment]) => ({
        questionId,
        comment,
      }));

      const source =
        aiDraftPending || data?.feedback?.overall?.source === 'ai_draft'
          ? 'ai_draft'
          : 'manual';

      const res = await fetch(`/api/teacher/attempts/${attemptId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overallComment,
          questionComments: qCommentPayload,
          released,
          source,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to save feedback');
      }

      setAiDraftPending(false);

      if (onFeedbackSaved) {
        onFeedbackSaved();
      }

      // Display friendly success toast
      toast.success(released ? MESSAGES.success.released : MESSAGES.success.saved);

      // Pop back (close the dialog)
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = mapApiError(err, 'Failed to save feedback. Please try again.').message;
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAiVisibility = async () => {
    if (!attemptId) return;
    setTogglingAiVisibility(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/teacher/attempts/${attemptId}/ai-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_visibility' }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to toggle AI feedback visibility');
      }
      const refreshRes = await fetch(`/api/teacher/attempts/${attemptId}`, { cache: 'no-store' });
      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json();
        setData(refreshJson);
      }
      toast.success(json.message || 'Updated AI feedback visibility');
      if (onFeedbackSaved) onFeedbackSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating AI feedback visibility';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setTogglingAiVisibility(false);
    }
  };

  const handleRegenerateAiFeedback = async () => {
    if (!attemptId) return;
    setRegeneratingAiFeedback(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/teacher/attempts/${attemptId}/ai-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to regenerate AI feedback');
      }
      const refreshRes = await fetch(`/api/teacher/attempts/${attemptId}`, { cache: 'no-store' });
      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json();
        setData(refreshJson);
      }
      toast.success('AI feedback regenerated successfully');
      if (onFeedbackSaved) onFeedbackSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error regenerating AI feedback';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setRegeneratingAiFeedback(false);
    }
  };

  const isOverallReleased = data?.feedback?.overall?.released ?? false;

  const filteredQuestions = (data?.questions || []).filter((q) => {
    if (questionFilter === 'wrong') return q.status === 'wrong';
    if (questionFilter === 'correct') return q.status === 'correct';
    if (questionFilter === 'skipped') return q.status === 'skipped';
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-xl bg-card border-border">
        {/* Fixed Header */}
        <DialogHeader className="p-4 sm:p-5 pb-4 border-b border-border bg-card shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <span>{data?.attempt.student_name || 'Student Attempt Review'}</span>
                {data && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs capitalize',
                      data.attempt.status === 'auto_submitted'
                        ? 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/20'
                        : 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20'
                    )}
                  >
                    {data.attempt.status === 'auto_submitted' ? 'Auto-Submitted' : 'Submitted'}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {data?.exam.title} • Completed{' '}
                {data?.attempt.submitted_at
                  ? new Date(data.attempt.submitted_at).toLocaleString()
                  : ''}
              </DialogDescription>
            </div>

            {/* Top Score Pill */}
            {data && (
              <div className="flex items-center gap-2 text-xs font-semibold bg-secondary px-3 py-1.5 rounded-lg shrink-0 text-foreground">
                <Award className="w-4 h-4 text-primary" />
                <span>
                  {data.attempt.score} / {data.attempt.max_possible_score} marks (
                  {data.attempt.percentage}%)
                </span>
                <span className="text-muted-foreground">•</span>
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>{formatDuration(data.attempt.time_taken_seconds)}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading student submission and feedback...</p>
          </div>
        )}

        {!loading && data && (
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'feedback' | 'questions')}
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            {/* Tab navigation bar */}
            <div className="px-4 sm:px-5 pt-2.5 pb-2 border-b border-border bg-secondary/20 shrink-0 flex items-center justify-between gap-3 flex-wrap">
              <TabsList className="h-8 p-1 bg-secondary rounded-lg">
                <TabsTrigger value="feedback" className="text-xs px-3 py-1 gap-1.5 rounded-md font-medium">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Feedback & Overview</span>
                </TabsTrigger>
                <TabsTrigger value="questions" className="text-xs px-3 py-1 gap-1.5 rounded-md font-medium">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Questions & Responses ({data.questions.length})</span>
                  {data.attempt.wrong_count > 0 && (
                    <Badge variant="destructive" className="ml-1 text-[10px] py-0 px-1.5 h-4 font-normal">
                      {data.attempt.wrong_count} wrong
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <div className="text-xs text-muted-foreground hidden sm:block">
                {activeTab === 'feedback'
                  ? 'Review performance & save guidance'
                  : 'Inspect individual answers & leave question comments'}
              </div>
            </div>

            {/* Scrollable Tab Content Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-0 space-y-4">
              {errorMsg && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
                </Alert>
              )}

              {successMsg && (
                <Alert className="border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-xs font-medium">{successMsg}</AlertDescription>
                </Alert>
              )}

              {/* TAB 1: Feedback & Summary */}
              <TabsContent value="feedback" className="mt-0 space-y-4 focus-visible:outline-none">
                {/* Summary Metrics & Weak Topics */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-6 grid grid-cols-3 gap-2">
                    <div className="p-3 rounded-lg border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 text-center">
                      <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Correct
                      </div>
                      <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                        {data.attempt.correct_count}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-red-200/80 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 text-center">
                      <div className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                        Wrong
                      </div>
                      <div className="text-xl font-bold text-red-700 dark:text-red-300">
                        {data.attempt.wrong_count}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-secondary/50 text-center">
                      <div className="text-[11px] font-semibold text-muted-foreground">
                        Skipped
                      </div>
                      <div className="text-xl font-bold text-foreground">
                        {data.attempt.skipped_count}
                      </div>
                    </div>
                  </div>

                  {/* Weak Topics Callout */}
                  <div className="md:col-span-6 p-3 rounded-lg border border-border bg-card flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>Weak Topics (&lt; 50%)</span>
                    </div>
                    {data.attempt.weak_topics.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {data.attempt.weak_topics.map((topic) => (
                          <Badge
                            key={topic}
                            variant="destructive"
                            className="text-[10px] py-0 font-medium"
                          >
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        None! Scored ≥ 50% across all topics.
                      </p>
                    )}
                  </div>
                </div>

                {/* Student Automatic AI Feedback Card */}
                {data.feedback?.aiAuto ? (
                  <div className="p-4 rounded-lg border border-purple-200/80 dark:border-purple-900/60 bg-purple-50/30 dark:bg-purple-950/10 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-900 dark:text-purple-200">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>Student Automated Feedback</span>
                        </div>

                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono py-0 border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/40"
                        >
                          {data.feedback.aiAuto.source}
                        </Badge>

                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] py-0 font-medium',
                            data.feedback.aiAuto.released
                              ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20'
                              : 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/20'
                          )}
                        >
                          {data.feedback.aiAuto.released ? 'Visible to Student' : 'Hidden from Student'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleToggleAiVisibility}
                          disabled={togglingAiVisibility || regeneratingAiFeedback}
                          className="h-7 text-xs border-border hover:bg-secondary"
                        >
                          {togglingAiVisibility ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : data.feedback.aiAuto.released ? (
                            <EyeOff className="w-3 h-3 mr-1 text-amber-600" />
                          ) : (
                            <Eye className="w-3 h-3 mr-1 text-emerald-600" />
                          )}
                          {data.feedback.aiAuto.released ? 'Hide from student' : 'Show to student'}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRegenerateAiFeedback}
                          disabled={togglingAiVisibility || regeneratingAiFeedback}
                          className="h-7 text-xs border-purple-300 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                          title="Regenerate automatic AI feedback"
                        >
                          {regeneratingAiFeedback ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3 mr-1 text-purple-600 dark:text-purple-400" />
                          )}
                          Regenerate
                        </Button>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-card/80 border border-purple-100 dark:border-purple-900/40 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                      {data.feedback.aiAuto.comment}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-border bg-secondary/30 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Student Automated Feedback: Not yet generated.</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateAiFeedback}
                      disabled={regeneratingAiFeedback}
                      className="h-7 text-xs"
                    >
                      {regeneratingAiFeedback ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Sparkles className="w-3 h-3 mr-1 text-primary" />
                      )}
                      Generate now
                    </Button>
                  </div>
                )}

                {/* Overall Teacher Feedback Card */}
                <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">
                          Overall Feedback
                        </span>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSuggestFeedback}
                        disabled={
                          suggesting ||
                          saving ||
                          (data.attempt.status !== 'submitted' &&
                            data.attempt.status !== 'auto_submitted')
                        }
                        className="h-7 text-xs rounded-md border-primary/30 text-primary hover:bg-primary/10"
                        title="Generate personalized feedback suggestion using AI"
                      >
                        {suggesting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Suggesting...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />
                            Suggest feedback
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      {aiDraftPending ? (
                        <Badge
                          variant="outline"
                          className="text-xs font-normal py-0 border-border bg-secondary text-foreground rounded"
                        >
                          AI Draft (Unsaved)
                        </Badge>
                      ) : data.feedback.overall ? (
                        <div className="flex items-center gap-1.5">
                          {data.feedback.overall.source === 'ai_draft' && (
                            <Badge
                              variant="outline"
                              className="text-xs font-normal py-0 border-border bg-secondary text-foreground rounded"
                            >
                              AI Draft
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs font-medium py-0 rounded',
                              isOverallReleased
                                ? 'border-emerald-400 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                                : 'border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-500/10'
                            )}
                          >
                            {isOverallReleased ? 'Released' : 'Draft'}
                          </Badge>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs py-0 text-muted-foreground rounded">
                          Unsaved
                        </Badge>
                      )}

                      <span className="text-xs text-muted-foreground">
                        {overallComment.length}/1000
                      </span>
                    </div>
                  </div>

                  {aiDraftPending && (
                    <div className="flex items-center gap-2 text-xs text-foreground bg-secondary/80 p-3 rounded-lg border border-border">
                      <Sparkles className="w-4 h-4 text-primary shrink-0" />
                      <span>
                        AI suggested draft loaded. You can review and edit before saving. Nothing will be visible to the student until you submit/release.
                      </span>
                    </div>
                  )}

                  <Textarea
                    placeholder="Write overall guidance, encouragement, or syllabus advice for this student (max 1000 characters)..."
                    value={overallComment}
                    onChange={(e) => setOverallComment(e.target.value.slice(0, 1000))}
                    className="text-sm min-h-[110px] rounded-lg bg-card resize-y"
                  />
                </div>
              </TabsContent>

              {/* TAB 2: Questions & Responses */}
              <TabsContent value="questions" className="mt-0 space-y-4 focus-visible:outline-none">
                {/* Filter chip bar */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground mr-1">Filter:</span>
                    <Button
                      variant={questionFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setQuestionFilter('all')}
                      className="h-7 text-xs px-2.5 rounded-md"
                    >
                      All ({data.questions.length})
                    </Button>
                    <Button
                      variant={questionFilter === 'wrong' ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => setQuestionFilter('wrong')}
                      className="h-7 text-xs px-2.5 rounded-md"
                    >
                      Wrong ({data.attempt.wrong_count})
                    </Button>
                    <Button
                      variant={questionFilter === 'correct' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setQuestionFilter('correct')}
                      className={cn(
                        'h-7 text-xs px-2.5 rounded-md',
                        questionFilter === 'correct'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : ''
                      )}
                    >
                      Correct ({data.attempt.correct_count})
                    </Button>
                    <Button
                      variant={questionFilter === 'skipped' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setQuestionFilter('skipped')}
                      className="h-7 text-xs px-2.5 rounded-md"
                    >
                      Skipped ({data.attempt.skipped_count})
                    </Button>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    Showing {filteredQuestions.length} of {data.questions.length} questions
                  </span>
                </div>

                {filteredQuestions.length === 0 ? (
                  <div className="p-8 text-center border border-dashed rounded-lg text-muted-foreground text-xs">
                    No questions match the selected &quot;{questionFilter}&quot; filter.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredQuestions.map((q) => {
                      const optionsList: { id: string; text: string }[] = Array.isArray(q.options)
                        ? q.options
                        : Object.entries(q.options || {}).map(([id, text]) => ({
                            id,
                            text: String(text),
                          }));

                      const isCorrect = q.status === 'correct';
                      const isWrong = q.status === 'wrong';
                      const isSkipped = q.status === 'skipped';
                      const qFb = data.feedback.byQuestion[q.id];
                      const currentQComment = questionComments[q.id] || '';

                      return (
                        <div
                          key={q.id}
                          className={cn(
                            'p-3.5 sm:p-4 rounded-lg border text-xs space-y-2.5 transition-colors',
                            isCorrect
                              ? 'border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/10'
                              : isWrong
                              ? 'border-red-200/80 dark:border-red-900/60 bg-red-50/10'
                              : 'border-border bg-card'
                          )}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-foreground">
                                Question {q.number}
                              </span>
                              {q.topic && (
                                <Badge variant="outline" className="text-[10px] py-0 font-normal">
                                  {q.topic}
                                </Badge>
                              )}
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground">
                                {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                              </span>
                            </div>

                            <div>
                              {isCorrect && (
                                <Badge className="bg-emerald-600 text-white text-[11px] py-0 flex items-center gap-1 font-medium">
                                  <CheckCircle2 className="w-3 h-3" /> Correct (+{q.score_earned})
                                </Badge>
                              )}
                              {isWrong && (
                                <Badge variant="destructive" className="text-[11px] py-0 flex items-center gap-1 font-medium">
                                  <XCircle className="w-3 h-3" /> Wrong ({q.score_earned})
                                </Badge>
                              )}
                              {isSkipped && (
                                <Badge variant="secondary" className="text-[11px] py-0 flex items-center gap-1 font-medium">
                                  <MinusCircle className="w-3 h-3" /> Skipped (0)
                                </Badge>
                              )}
                            </div>
                          </div>

                          <p className="font-medium text-foreground whitespace-pre-wrap leading-relaxed">
                            {q.text}
                          </p>

                          {/* Options Grid */}
                          <div className="space-y-1.5">
                            {optionsList.map((opt) => {
                              const isStudentChoice =
                                q.chosen_option?.trim().toUpperCase() ===
                                opt.id.trim().toUpperCase();
                              const isTheCorrectOption =
                                q.correct_option?.trim().toUpperCase() ===
                                opt.id.trim().toUpperCase();

                              return (
                                <div
                                  key={opt.id}
                                  className={cn(
                                    'flex items-center justify-between p-2 rounded-md border text-xs',
                                    isStudentChoice &&
                                      !isTheCorrectOption &&
                                      'border-red-300 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200 font-medium',
                                    isTheCorrectOption &&
                                      'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium',
                                    !isStudentChoice &&
                                      !isTheCorrectOption &&
                                      'border-border text-muted-foreground'
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold uppercase shrink-0',
                                        isStudentChoice && !isTheCorrectOption && 'bg-red-200 text-red-800',
                                        isTheCorrectOption && 'bg-emerald-200 text-emerald-800',
                                        !isStudentChoice && !isTheCorrectOption && 'bg-secondary text-muted-foreground'
                                      )}
                                    >
                                      {opt.id}
                                    </span>
                                    <span>{opt.text}</span>
                                  </div>

                                  <div className="shrink-0 text-[10px]">
                                    {isStudentChoice && isTheCorrectOption && (
                                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                        Student Answer (Correct)
                                      </span>
                                    )}
                                    {isStudentChoice && !isTheCorrectOption && (
                                      <span className="text-red-700 dark:text-red-400 font-semibold">
                                        Student Answer
                                      </span>
                                    )}
                                    {!isStudentChoice && isTheCorrectOption && (
                                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                        Correct Answer
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Explanation */}
                          {q.explanation && (
                            <div className="p-2.5 rounded-md bg-secondary/60 text-[11px] text-muted-foreground">
                              <span className="font-semibold text-foreground">
                                Explanation:{' '}
                              </span>
                              {q.explanation}
                            </div>
                          )}

                          {/* Per-Question Teacher Comment Field */}
                          <div className="pt-2 border-t border-border space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-medium text-foreground">
                                Teacher Comment for Question {q.number}:
                              </span>

                              <div className="flex items-center gap-1.5">
                                {qFb ? (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[10px] py-0 font-normal',
                                      qFb.released
                                        ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20'
                                        : 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/20'
                                    )}
                                  >
                                    {qFb.released ? 'Released' : 'Draft'}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">None</span>
                                )}
                                <span className="text-muted-foreground text-[10px]">
                                  {currentQComment.length}/1000
                                </span>
                              </div>
                            </div>

                            <Textarea
                              placeholder={`Add a specific hint, feedback or correction for Question ${q.number}...`}
                              value={currentQComment}
                              onChange={(e) =>
                                setQuestionComments((prev) => ({
                                  ...prev,
                                  [q.id]: e.target.value.slice(0, 1000),
                                }))
                              }
                              className="text-xs min-h-[55px] bg-card rounded-md"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-3 sm:px-5 border-t border-border bg-card shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                {isOverallReleased ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-400 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 text-xs py-0"
                  >
                    Released to student
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-500/10 text-xs py-0"
                  >
                    Draft feedback
                  </Badge>
                )}
                <span className="text-muted-foreground hidden sm:inline">
                  Overall: {overallComment.length}/1000 chars
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                  className="h-8 text-xs rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="h-8 text-xs rounded-lg"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Save Draft
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="h-8 text-xs rounded-lg bg-primary text-primary-foreground font-medium shadow-xs"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Release to Student
                </Button>
              </div>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
