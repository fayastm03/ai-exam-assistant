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
} from 'lucide-react';

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
      source?: 'manual' | 'ai_draft';
      updated_at: string;
    } | null;
    byQuestion: Record<
      string,
      { id: string; comment: string; released: boolean; source?: 'manual' | 'ai_draft'; updated_at: string }
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
          setOverallComment(json.feedback?.overall?.comment || '');

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

      const suggestedText = json.data?.feedback || '';
      setOverallComment(suggestedText);
      setAiDraftPending(true);
      setSuccessMsg('AI draft feedback suggested! You can review and edit it before saving.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error suggesting feedback');
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
        released
          ? 'Feedback released to the student!'
          : 'Draft feedback saved successfully.'
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
      setErrorMsg(err instanceof Error ? err.message : 'Error saving feedback');
    } finally {
      setSaving(false);
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

            {/* Overall Feedback Form */}
            <div className="p-4 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      Overall Attempt Feedback
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
                    className="h-7 text-xs border-purple-300 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                    title="Generate personalized feedback suggestion using AI"
                  >
                    {suggesting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Suggesting feedback...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                        Suggest feedback
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {aiDraftPending ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium py-0 border-purple-400 text-purple-700 bg-purple-50 dark:bg-purple-950/40"
                    >
                      ✨ AI Draft (Unsaved)
                    </Badge>
                  ) : data.feedback.overall ? (
                    <div className="flex items-center gap-1.5">
                      {data.feedback.overall.source === 'ai_draft' && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium py-0 border-purple-300 text-purple-600 bg-purple-50/50 dark:bg-purple-950/20"
                        >
                          AI Draft
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-medium py-0',
                          isOverallReleased
                            ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20'
                            : 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/20'
                        )}
                      >
                        {isOverallReleased ? 'Released' : 'Draft'}
                      </Badge>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 text-neutral-400">
                      Unsaved
                    </Badge>
                  )}

                  <span className="text-[11px] text-neutral-400">
                    {overallComment.length}/1000 chars
                  </span>
                </div>
              </div>

              {aiDraftPending && (
                <div className="flex items-center gap-2 text-xs text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 p-2.5 rounded-md border border-purple-200 dark:border-purple-800/80">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>
                    AI suggested draft loaded. You can review and edit this comment before saving. Nothing will be visible to the student until you click <strong>Release</strong>.
                  </span>
                </div>
              )}

              <Textarea
                placeholder="Write overall guidance, encouragement, or syllabus advice for this student (max 1000 characters)..."
                value={overallComment}
                onChange={(e) => setOverallComment(e.target.value.slice(0, 1000))}
                className="text-xs min-h-[90px] bg-white dark:bg-neutral-900 resize-y"
              />

              {/* Action Buttons for Feedback */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="text-xs h-8"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5 mr-1" />
                  )}
                  Save Draft
                </Button>

                <Button
                  size="sm"
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 mr-1" />
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
