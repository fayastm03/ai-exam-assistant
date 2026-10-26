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
  Loader2,
  HelpCircle,
  BarChart3,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

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
    'questions' | 'import' | 'bulk' | 'settings' | 'preview'
  >('questions');

  // Question Editor Dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);

  // Deleting question id state
  const [deletingQId, setDeletingQId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

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

      fetchExamData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to duplicate question');
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
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete question');
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
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to reorder questions');
    } finally {
      setReordering(false);
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
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error approving question');
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
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col gap-4 border-b border-neutral-200/80 dark:border-neutral-800 pb-5">
        <div className="flex items-center justify-between">
          <Link
            href="/teacher/exams"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'text-neutral-500 hover:text-neutral-900 -ml-2 h-8 text-xs'
            )}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to All Exams
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/teacher/exams/${exam.id}/results`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-xs h-8')}
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
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
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                {exam.title}
              </h1>
              {renderStatusBadge(exam.status)}
            </div>
            {exam.instructions && (
              <p className="text-xs text-neutral-500 line-clamp-2 max-w-2xl">{exam.instructions}</p>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-medium text-neutral-500 bg-neutral-100 dark:bg-neutral-800/60 px-3 py-1.5 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>{exam.duration_min} mins</span>
            <span>•</span>
            <span>{questions.length} Questions</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as 'questions' | 'import' | 'bulk' | 'settings' | 'preview')
        }
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full sm:w-auto sm:inline-grid">
          <TabsTrigger value="questions" className="text-xs sm:text-sm">
            Questions ({questions.length})
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

            <div className="flex items-center gap-2">
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
              {questions.map((q, index) => (
                <Card
                  key={q.id}
                  className="border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                >
                  <CardHeader className="py-3 px-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 rounded text-neutral-800 dark:text-neutral-200">
                          #{q.number}
                        </span>
                        {q.topic && (
                          <Badge variant="secondary" className="text-[10px] py-0">
                            {q.topic}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] py-0 font-medium">
                          {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                        </Badge>

                        {q.source === 'imported' && (
                          <Badge variant="outline" className="text-[10px] py-0 text-blue-600 border-blue-200">
                            Imported
                          </Badge>
                        )}

                        {q.review_status === 'draft' ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                          >
                            Draft
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"
                          >
                            Approved
                          </Badge>
                        )}

                        {(!q.correct_option || q.correct_option === 'UNSET') && (
                          <Badge variant="destructive" className="text-[10px] py-0 font-medium">
                            No Correct Option
                          </Badge>
                        )}

                        {q.text.includes('[unclear]') && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950"
                          >
                            Contains [unclear]
                          </Badge>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        {q.review_status === 'draft' && q.correct_option && q.correct_option !== 'UNSET' && (
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

                    {q.explanation && (
                      <div className="text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-900 p-2.5 rounded border border-neutral-100 dark:border-neutral-800/80 mt-1">
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                          Explanation:{' '}
                        </span>
                        {q.explanation}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Paper Import */}
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
