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
          setOverallComment((prev) => (prev && prev.trim().length > 0 ? prev : (json.feedback?.overall?.comment || '')));

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
        throw new Error('AI rate limit reached. The AI provider is busy. Please wait a moment and try again.');
      }

      if (!res.ok) {
        throw new Error(json.message || 'Failed to generate feedback suggestion');
      }

      const suggestedText =
        typeof json.feedback === 'string' ? json.feedback.trim() : (json.data?.feedback || '');
      if (!suggestedText) {
        throw new Error('AI returned an empty feedback suggestion');
      }
      setOverallComment(suggestedText);
      setAiDraftPending(true);
      setSuccessMsg('AI draft feedback suggested. You can review and edit it before saving.');
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

      // If this comment was suggested by AI, save it with source: 'ai_draft'
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
      setSuccessMsg(
        released ? MESSAGES.success.released : MESSAGES.success.saved
      );

      // Re-fetch to update release statuses
      const refreshRes = await fetch(`/api/teacher/attempts/${attemptId}`, {
        cache: 'no-store',
      });
      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json();
        setData(refreshJson);
      }

      if (onFeedbackSaved) {
        onFeedbackSaved();
      }
    } catch (err: unknown) {
      setErrorMsg(mapApiError(err, 'Failed to save feedback. Please try again.').message);
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
      setSuccessMsg(json.message || 'Updated AI feedback visibility');
      if (onFeedbackSaved) onFeedbackSaved();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error updating AI feedback visibility');
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
      setSuccessMsg('AI feedback regenerated successfully');
      if (onFeedbackSaved) onFeedbackSaved();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error regenerating AI feedback');
    } finally {
      setRegeneratingAiFeedback(false);
    }
  };

  const isOverallReleased = data?.feedback?.overall?.released ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3 border-b border-neutral-200/80 dark:border-neutral-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
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
              <DialogDescription className="text-xs text-neutral-500 mt-1">
                {data?.exam.title} • Completed{' '}
                {data?.attempt.submitted_at
                  ? new Date(data.attempt.submitted_at).toLocaleString()
                  : ''}
              </DialogDescription>
            </div>

            {/* Top Score Pill */}
            {data && (
              <div className="flex items-center gap-2 text-xs font-semibold bg-neutral-100 dark:bg-neutral-800/80 px-3 py-1.5 rounded-lg shrink-0">
                <Award className="w-4 h-4 text-blue-600" />
                <span>
                  {data.attempt.score} / {data.attempt.max_possible_score} marks (
                  {data.attempt.percentage}%)
                </span>
                <span>•</span>
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>{formatDuration(data.attempt.time_taken_seconds)}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs text-neutral-500">Loading student submission and feedback...</p>
          </div>
        )}

        {errorMsg && (
          <Alert variant="destructive" className="my-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
          </Alert>
        )}

        {successMsg && (
          <Alert className="my-2 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-xs font-medium">{successMsg}</AlertDescription>
          </Alert>
        )}

        {!loading && data && (
          <div className="space-y-6 pt-2">
            {/* Summary Metrics & Weak Topics */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6 grid grid-cols-3 gap-2">
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
                  <div className="text-[11px] font-semibold text-emerald-600">Correct</div>
                  <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    {data.attempt.correct_count}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 text-center">
                  <div className="text-[11px] font-semibold text-red-600">Wrong</div>
                  <div className="text-xl font-bold text-red-700 dark:text-red-300">
                    {data.attempt.wrong_count}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-100/60 dark:bg-neutral-800 text-center">
                  <div className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                    Skipped
                  </div>
                  <div className="text-xl font-bold text-neutral-700 dark:text-neutral-300">
                    {data.attempt.skipped_count}
                  </div>
                </div>
              </div>

              {/* Weak Topics Callout */}
              <div className="md:col-span-6 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Weak Topics (&lt; 50%)
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
                  <p className="text-[11px] text-emerald-600 font-medium">
                    None! Scored $\ge 50\%$ across all topics.
                  </p>
                )}
              </div>
            </div>

            {/* Student Automatic AI Feedback Row */}
            {data.feedback?.aiAuto ? (
              <div className="p-4 rounded-xl border border-purple-200/80 dark:border-purple-900/60 bg-purple-50/30 dark:bg-purple-950/10 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-900 dark:text-purple-200">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
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
                      className="h-7 text-xs border-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
                      className="h-7 text-xs border-purple-300 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                      title="Regenerate automatic AI feedback (max once per minute)"
                    >
                      {regeneratingAiFeedback ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3 mr-1 text-purple-600" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-white/80 dark:bg-neutral-900/80 border border-purple-100 dark:border-purple-900/40 text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
                  {data.feedback.aiAuto.comment}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center justify-between text-xs text-neutral-500">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
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
                    <Sparkles className="w-3 h-3 mr-1 text-purple-600" />
                  )}
                  Generate now
                </Button>
              </div>
            )}

            {/* Overall Feedback Form */}
            <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
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
                      (data.attempt.status !== 'submitted' && data.attempt.status !== 'auto_submitted')
                    }
                    className="h-8 text-xs rounded-lg"
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
                        Suggest Feedback
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
                <div className="flex items-center gap-2 text-xs text-foreground bg-secondary p-3 rounded-lg border border-border">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    AI suggested draft loaded. You can review and edit before saving. Nothing is visible to the student until you click <strong>Release</strong>.
                  </span>
                </div>
              )}

              <Textarea
                placeholder="Write overall guidance, encouragement, or syllabus advice for this student (max 1000 characters)..."
                value={overallComment}
                onChange={(e) => setOverallComment(e.target.value.slice(0, 1000))}
                className="text-base sm:text-sm min-h-[100px] rounded-lg bg-card resize-y"
              />

              {/* Action Buttons for Feedback */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="text-xs h-9 px-3 rounded-lg"
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
                  className="text-xs h-9 px-4 rounded-lg bg-primary text-primary-foreground font-medium"
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

            {/* Questions List with Student Answers & Per-Question Comments */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
                <span>Questions & Student Responses ({data.questions.length})</span>
                <span className="text-xs font-normal text-neutral-500">
                  Optional per-question comment can be added below each question
                </span>
              </h3>

              <div className="space-y-4">
                {data.questions.map((q) => {
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
                        'p-4 rounded-xl border text-xs space-y-3 transition-colors',
                        isCorrect
                          ? 'border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/10'
                          : isWrong
                            ? 'border-red-200/80 dark:border-red-900/60 bg-red-50/10'
                            : 'border-neutral-200 dark:border-neutral-800'
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-neutral-900 dark:text-neutral-100">
                            Question {q.number}
                          </span>
                          {q.topic && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              {q.topic}
                            </Badge>
                          )}
                          <span className="text-neutral-400">•</span>
                          <span className="text-neutral-500">
                            {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                          </span>
                        </div>

                        <div>
                          {isCorrect && (
                            <Badge className="bg-emerald-600 text-white text-[11px] py-0 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Correct (+{q.score_earned})
                            </Badge>
                          )}
                          {isWrong && (
                            <Badge variant="destructive" className="text-[11px] py-0 flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Wrong ({q.score_earned})
                            </Badge>
                          )}
                          {isSkipped && (
                            <Badge variant="secondary" className="text-[11px] py-0 flex items-center gap-1">
                              <MinusCircle className="w-3 h-3" /> Skipped (0)
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p className="font-medium text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap leading-relaxed">
                        {q.text}
                      </p>

                      {/* Options Grid */}
                      <div className="space-y-1.5">
                        {optionsList.map((opt) => {
                          const isStudentChoice =
                            q.chosen_option?.trim().toUpperCase() === opt.id.trim().toUpperCase();
                          const isTheCorrectOption =
                            q.correct_option?.trim().toUpperCase() === opt.id.trim().toUpperCase();

                          return (
                            <div
                              key={opt.id}
                              className={cn(
                                'flex items-center justify-between p-2 rounded-md border text-xs',
                                isStudentChoice && !isTheCorrectOption &&
                                  'border-red-300 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200 font-medium',
                                isTheCorrectOption &&
                                  'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium',
                                !isStudentChoice && !isTheCorrectOption &&
                                  'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold uppercase shrink-0',
                                    isStudentChoice && !isTheCorrectOption && 'bg-red-200 text-red-800',
                                    isTheCorrectOption && 'bg-emerald-200 text-emerald-800',
                                    !isStudentChoice && !isTheCorrectOption && 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800'
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
                        <div className="p-2.5 rounded-lg bg-neutral-100/70 dark:bg-neutral-800/50 text-[11px] text-neutral-600 dark:text-neutral-400">
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                            Explanation:{' '}
                          </span>
                          {q.explanation}
                        </div>
                      )}

                      {/* Per-Question Teacher Comment Field */}
                      <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                            Teacher Comment for Question {q.number}:
                          </span>

                          <div className="flex items-center gap-1.5">
                            {qFb ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] py-0',
                                  qFb.released
                                    ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20'
                                    : 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/20'
                                )}
                              >
                                {qFb.released ? 'Released' : 'Draft'}
                              </Badge>
                            ) : (
                              <span className="text-neutral-400 text-[10px]">None</span>
                            )}
                            <span className="text-neutral-400 text-[10px]">
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
                          className="text-xs min-h-[60px] bg-white dark:bg-neutral-900"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
