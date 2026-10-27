'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QuestionEditorDialog, QuestionData } from '@/components/teacher/question-editor-dialog';
import { ExamSettingsTab } from '@/components/teacher/exam-settings-tab';
import { BulkPasteTab } from '@/components/teacher/bulk-paste-tab';
import { PaperImportTab } from '@/components/teacher/paper-import-tab';
import { GenerateNotesTab } from '@/components/teacher/generate-notes-tab';
import { StudentPreviewTab } from '@/components/teacher/student-preview-tab';
import { PublishButtonWithDialog } from '@/components/teacher/publish-dialog';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Clock,
  FileText,
  AlertCircle,
  AlertTriangle,
  Loader2,
  HelpCircle,
  BarChart3,
  Sparkles,
  CheckCircle2,
  CheckCheck,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { mapApiError, MESSAGES } from '@/lib/messages';

interface QuestionItem {
  id: string;
  exam_id: string;
  number: number;
  text: string;
  options: { id: string; text: string }[];
  correct_option: string;
  marks: number;
  topic: string | null;
  explanation: string | null;
  source: 'manual' | 'imported' | 'generated';
  review_status: 'draft' | 'approved';
  created_at: string;
  updated_at: string;
}

interface ExamDetail {
  id: string;
  teacher_id: string;
  title: string;
  instructions: string | null;
  duration_min: number;
  open_at: string | null;
  close_at: string | null;
  negative_marking: number;
  shuffle: boolean;
  status: 'draft' | 'published' | 'closed';
  created_at: string;
  updated_at: string;
}

export default function TeacherExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: examId } = use(params);

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active tab state
  const [activeTab, setActiveTab] = useState<
    'questions' | 'generate' | 'import' | 'bulk' | 'settings' | 'preview'
  >('questions');

  // AI Explanations state
  const [explaining, setExplaining] = useState(false);
  const [explainBanner, setExplainBanner] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    details?: string[];
  } | null>(null);

  // Question Editor Dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);

  // Deleting question id state
  const [deletingQId, setDeletingQId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  const fetchExamData = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const res = await fetch(`/api/teacher/exams/${examId}`, { cache: 'no-store' });
        const data = await res.json();
        if (!ignore) {
          if (!res.ok) {
            throw new Error(data.message || 'Failed to fetch exam');
          }
          setExam(data.exam);
          setQuestions(data.questions || []);
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
  }, [examId, refreshKey]);

  const handleOpenAddQuestion = () => {
    setEditingQuestion(null);
    setEditorOpen(true);
  };

  const handleOpenEditQuestion = (q: QuestionItem) => {
    setEditingQuestion({
      id: q.id,
      number: q.number,
      text: q.text,
      options: q.options,
      correct_option: q.correct_option,
      marks: q.marks,
      topic: q.topic,
      explanation: q.explanation,
    });
    setEditorOpen(true);
  };

  const handleDuplicateQuestion = async (q: QuestionItem) => {
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${q.text} (Copy)`,
          options: q.options,
          correct_option: q.correct_option,
          marks: q.marks,
          topic: q.topic,
          explanation: q.explanation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to duplicate question');
      }

      toast.success(MESSAGES.success.questionDuplicated);
      fetchExamData();
    } catch (err: unknown) {
      toast.error(mapApiError(err, 'Failed to duplicate question.').message);
    }
  };

  const handleDeleteQuestion = async (qId: string, qNum: number) => {
    if (!confirm(`Delete question #${qNum}? This cannot be undone.`)) return;

    setDeletingQId(qId);
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/questions/${qId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete question');
      }
      setQuestions((prev) => prev.filter((item) => item.id !== qId));
      toast.success(MESSAGES.success.questionDeleted);
    } catch (err: unknown) {
      toast.error(mapApiError(err, 'Failed to delete question.').message);
    } finally {
      setDeletingQId(null);
    }
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    if (reordering) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const currentQ = questions[index];
    const targetQ = questions[targetIndex];

    setReordering(true);
    try {
      // Swap number fields
      const currentNum = currentQ.number;
      const targetNum = targetQ.number;

      // Update currentQ
      await fetch(`/api/teacher/exams/${examId}/questions/${currentQ.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: targetNum }),
      });

      // Update targetQ
      await fetch(`/api/teacher/exams/${examId}/questions/${targetQ.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: currentNum }),
      });

      await fetchExamData();
      toast.success(MESSAGES.success.saved);
    } catch (err: unknown) {
      toast.error(mapApiError(err, 'Failed to reorder questions.').message);
    } finally {
      setReordering(false);
    }
  };

  const draftQuestions = questions.filter(
    (q) => q.review_status === 'draft' && q.correct_option && q.correct_option !== 'UNSET'
  );
  const draftCount = draftQuestions.length;

  const handleApproveAllQuestions = async () => {
    if (draftCount === 0 || approvingAll) return;
    setApprovingAll(true);
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/questions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_all' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to approve questions');
      }
      await fetchExamData();
      const count = data.count ?? draftCount;
      toast.success(
        count === 1
          ? '1 question approved.'
          : `All ${count} questions approved.`
      );
    } catch (err: unknown) {
      toast.error(mapApiError(err, 'Could not approve questions.').message);
    } finally {
      setApprovingAll(false);
    }
  };

  const handleApproveQuestion = async (qId: string) => {
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/questions/${qId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_status: 'approved' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to approve question');
      }
      fetchExamData();
      toast.success('Question approved.');
    } catch (err: unknown) {
      toast.error(mapApiError(err, 'Could not approve question.').message);
    }
  };

  const handleWriteExplanations = async () => {
    if (questions.length === 0) return;
    setExplaining(true);
    setExplainBanner(null);

    try {
      const res = await fetch(`/api/teacher/exams/${examId}/explain`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.status === 429) {
        setExplainBanner({
          type: 'warning',
          message: 'AI Rate Limit Reached: The Gemini API quota was exceeded. Please wait 30 seconds and try again.',
        });
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || 'Failed to generate explanations');
      }

      fetchExamData();

      if (data.data?.flaggedCount > 0) {
        setExplainBanner({
          type: 'warning',
          message: `Generated explanations for ${data.data.updatedCount} question(s). AI flagged ${data.data.flaggedCount} question(s) with potential issues. Please review them below!`,
          details: data.data.flaggedQuestions?.map(
            (fq: { number: number; reason: string }) => `Question #${fq.number}: ${fq.reason}`
          ),
        });
      } else {
        setExplainBanner({
          type: 'success',
          message: `Successfully generated educational explanations for all ${data.data?.updatedCount || questions.length} question(s) as drafts.`,
        });
      }
    } catch (err: unknown) {
      setExplainBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to generate explanations',
      });
    } finally {
      setExplaining(false);
    }
  };

  const renderStatusBadge = (status: ExamDetail['status']) => {
    switch (status) {
      case 'published':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs">
            Published
          </Badge>
        );
      case 'draft':
        return (
          <Badge
            variant="outline"
            className="border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 text-xs font-medium"
          >
            Draft
          </Badge>
        );
      case 'closed':
        return (
          <Badge variant="secondary" className="text-xs font-medium">
            Closed
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-neutral-500">Loading exam details...</p>
      </div>
    );
  }

  if (errorMsg || !exam) {
    return (
      <div className="space-y-4">
        <Link
          href="/teacher/exams"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs h-8')}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Exams
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMsg || 'Exam not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col gap-4 border-b border-border pb-5">
        <div className="flex items-center justify-between">
          <Link
            href="/teacher/exams"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'text-muted-foreground hover:text-foreground -ml-2 h-8 text-xs'
            )}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Exams
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/teacher/exams/${exam.id}/results`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-xs h-9 rounded-lg')}
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-primary" />
              Class Results
            </Link>

            <PublishButtonWithDialog
              examId={exam.id}
              isPublished={exam.status === 'published'}
              onPublishedSuccess={(updated) =>
                setExam((prev) => (prev ? { ...prev, status: updated.status } : null))
              }
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {exam.title}
              </h1>
              {renderStatusBadge(exam.status)}
            </div>
            {exam.instructions && (
              <p className="text-xs text-muted-foreground line-clamp-2 max-w-2xl">{exam.instructions}</p>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-medium text-muted-foreground bg-secondary px-3 py-1.5 rounded-lg border border-border">
            <Clock className="w-3.5 h-3.5" />
            <span>{exam.duration_min} mins</span>
            <span>•</span>
            <span>{questions.length} {questions.length === 1 ? 'question' : 'questions'}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as 'questions' | 'generate' | 'import' | 'bulk' | 'settings' | 'preview')
        }
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-2 sm:grid-cols-6 w-full sm:w-auto sm:inline-grid">
          <TabsTrigger value="questions" className="text-xs sm:text-sm">
            Questions ({questions.length})
          </TabsTrigger>
          <TabsTrigger value="generate" className="text-xs sm:text-sm flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            Generate (AI)
          </TabsTrigger>
          <TabsTrigger value="import" className="text-xs sm:text-sm flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            Import Paper
          </TabsTrigger>
          <TabsTrigger value="bulk" className="text-xs sm:text-sm">
            Bulk Paste
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm">
            Settings
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs sm:text-sm">
            Student Preview
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Questions Editor */}
        <TabsContent value="questions" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Exam Questions</h2>
              <p className="text-xs text-neutral-500">
                Manage, reorder, duplicate, and configure questions for this exam.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {draftCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApproveAllQuestions}
                  disabled={approvingAll}
                  className="text-xs text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg h-8 shadow-xs"
                  title="Approve all draft questions with a set answer"
                >
                  {approvingAll ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                      Approve All ({draftCount})
                    </>
                  )}
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleWriteExplanations}
                disabled={explaining || questions.length === 0}
                className="text-xs text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                title="Generate AI explanations for all questions in this exam"
              >
                {explaining ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Writing Explanations...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                    Write explanations
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('generate')}
                className="text-xs text-purple-600 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950/20"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Generate Notes
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('import')}
                className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/20"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Import Paper
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('bulk')}
                className="text-xs"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Bulk Paste
              </Button>

              <Button onClick={handleOpenAddQuestion} size="sm" className="shadow-sm text-xs">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Question
              </Button>
            </div>
          </div>

          {/* Explanation Alert Banner */}
          {explainBanner && (
            <Alert
              variant={explainBanner.type === 'error' ? 'destructive' : 'default'}
              className={
                explainBanner.type === 'warning'
                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                  : explainBanner.type === 'success'
                  ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100'
                  : ''
              }
            >
              {explainBanner.type === 'warning' ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : explainBanner.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription className="text-xs space-y-1">
                <p className="font-semibold">{explainBanner.message}</p>
                {explainBanner.details && (
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                    {explainBanner.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {questions.length === 0 ? (
            <Card className="border-dashed py-12 text-center bg-neutral-50/50 dark:bg-neutral-900/50">
              <CardContent className="flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div className="max-w-sm space-y-1">
                  <CardTitle className="text-base">No questions added yet</CardTitle>
                  <CardDescription className="text-xs">
                    Every exam requires at least one question with $\ge 2$ choices to be published.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleOpenAddQuestion} size="sm">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Question Manually
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('bulk')}>
                    <FileText className="w-3.5 h-3.5 mr-1.5" /> Bulk Paste Questions
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {questions.map((q, index) => {
                const flagMatch = q.explanation?.match(/^\[AI Flag:\s*([^\]]+)\]\s*([\s\S]*)$/);
                const isFlagged = Boolean(flagMatch);
                const flagReason = flagMatch ? flagMatch[1].trim() : null;
                const cleanExplanation = flagMatch ? flagMatch[2].trim() : q.explanation;

                return (
                  <Card
                    key={q.id}
                    className={`rounded-lg border transition-colors shadow-sm ${
                      isFlagged
                        ? 'border-amber-400 bg-amber-500/5'
                        : 'border-border bg-card'
                    }`}
                  >
                    <CardHeader className="py-3 px-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs bg-secondary px-2.5 py-0.5 rounded text-foreground">
                            Question {q.number}
                          </span>
                          {q.topic && (
                            <Badge variant="outline" className="text-xs font-normal">
                              {q.topic}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                          </span>

                          {q.source === 'generated' && (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 text-primary border-border bg-secondary font-normal rounded"
                            >
                              Generated
                            </Badge>
                          )}

                          {q.source === 'imported' && (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 text-muted-foreground border-border rounded"
                            >
                              Imported
                            </Badge>
                          )}

                          {q.review_status === 'draft' ? (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 text-amber-700 dark:text-amber-400 border-amber-400 bg-amber-500/10 rounded font-normal"
                            >
                              Draft
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 text-emerald-700 dark:text-emerald-400 border-emerald-400 bg-emerald-500/10 rounded font-normal"
                            >
                              Approved
                            </Badge>
                          )}

                          {isFlagged && (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 text-amber-800 dark:text-amber-300 border-amber-400 bg-amber-500/10 rounded flex items-center gap-1 font-medium"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Flagged
                            </Badge>
                          )}

                          {(!q.correct_option || q.correct_option === 'UNSET') && (
                            <Badge variant="destructive" className="text-xs py-0 font-normal rounded">
                              No correct option
                            </Badge>
                          )}

                          {q.text.includes('[unclear]') && (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-400 rounded"
                            >
                              Contains [unclear]
                            </Badge>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1">
                          {q.review_status === 'draft' &&
                            q.correct_option &&
                            q.correct_option !== 'UNSET' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApproveQuestion(q.id)}
                                className="h-7 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 mr-1"
                                title="Approve Question"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Approve
                              </Button>
                            )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReorder(index, 'up')}
                            disabled={index === 0 || reordering}
                            className="h-7 w-7 p-0 text-neutral-400 hover:text-neutral-900"
                            title="Move Up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReorder(index, 'down')}
                            disabled={index === questions.length - 1 || reordering}
                            className="h-7 w-7 p-0 text-neutral-400 hover:text-neutral-900"
                            title="Move Down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicateQuestion(q)}
                            className="h-7 w-7 p-0 text-neutral-400 hover:text-blue-600"
                            title="Duplicate Question"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditQuestion(q)}
                            className="h-7 w-7 p-0 text-neutral-400 hover:text-blue-600"
                            title="Edit Question"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteQuestion(q.id, q.number)}
                            disabled={deletingQId === q.id}
                            className="h-7 w-7 p-0 text-neutral-400 hover:text-red-600"
                            title="Delete Question"
                          >
                            {deletingQId === q.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Prominent AI Flag Warning Box */}
                      {isFlagged && flagReason && (
                        <div className="mt-2.5 p-3 rounded-md border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-100 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200 mb-1">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>AI Verification Flag: Potential Issue Detected</span>
                          </div>
                          <p className="leading-relaxed pl-5 font-medium">{flagReason}</p>
                          <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 pl-5 italic">
                            The designated correct option has NOT been changed. Please review the statement, options, or correct answer above.
                          </p>
                        </div>
                      )}

                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 pt-1.5 whitespace-pre-line leading-relaxed">
                        {q.text}
                      </p>
                    </CardHeader>

                    <CardContent className="py-2 px-4 pb-3 space-y-2">
                      {/* Options list */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {Array.isArray(q.options) &&
                          q.options.map((opt) => {
                            const isCorrect = q.correct_option === opt.id;
                            return (
                              <div
                                key={opt.id}
                                className={`flex items-start gap-2 p-2 rounded-md border text-xs ${
                                  isCorrect
                                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100 font-medium'
                                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
                                }`}
                              >
                                <span className="font-bold text-[11px] w-4 text-center shrink-0">
                                  {opt.id}.
                                </span>
                                <span className="flex-1">{opt.text}</span>
                                {isCorrect && (
                                  <span className="text-[10px] text-emerald-600 font-bold shrink-0">
                                    ✓ Correct
                                  </span>
                                )}
                              </div>
                            );
                          })}
                      </div>

                      {cleanExplanation && (
                        <div className="text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-900 p-2.5 rounded border border-neutral-200/80 dark:border-neutral-800/80 mt-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                              {q.review_status === 'draft' ? 'Draft Explanation:' : 'Explanation:'}
                            </span>
                            {q.review_status === 'draft' && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                Draft (Teacher Review Required)
                              </span>
                            )}
                          </div>
                          <p className="leading-relaxed whitespace-pre-line">
                            {cleanExplanation}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Generate from Notes (AI) */}
        <TabsContent value="generate">
          <GenerateNotesTab
            examId={exam.id}
            onGenerated={fetchExamData}
            onNavigateToQuestions={() => setActiveTab('questions')}
          />
        </TabsContent>

        {/* Tab 3: Paper Import */}
        <TabsContent value="import">
          <PaperImportTab examId={exam.id} onImportCompleted={fetchExamData} />
        </TabsContent>

        {/* Tab 3: Bulk Paste */}
        <TabsContent value="bulk">
          <BulkPasteTab examId={exam.id} onQuestionsAdded={fetchExamData} />
        </TabsContent>

        {/* Tab 3: Exam Settings */}
        <TabsContent value="settings">
          <ExamSettingsTab
            key={exam.id + exam.updated_at}
            exam={exam}
            onExamUpdated={(updated) =>
              setExam((prev) => (prev ? { ...prev, ...updated } : null))
            }
          />
        </TabsContent>

        {/* Tab 4: Student Preview */}
        <TabsContent value="preview">
          <StudentPreviewTab exam={exam} questions={questions} />
        </TabsContent>
      </Tabs>

      {/* Add / Edit Question Modal */}
      <QuestionEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initialQuestion={editingQuestion}
        examId={exam.id}
        onSaved={fetchExamData}
      />
    </div>
  );
}
