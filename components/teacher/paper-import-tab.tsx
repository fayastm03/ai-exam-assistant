'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QuestionEditorDialog, QuestionData } from './question-editor-dialog';
import { cn } from '@/lib/utils';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Edit,
  Trash2,
  Sparkles,
  FileUp,
} from 'lucide-react';
import { MESSAGES, mapApiError } from '@/lib/messages';

export interface ImportedQuestionItem {
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
}

interface FileInfo {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

interface PaperImportTabProps {
  examId: string;
  onImportCompleted: () => void;
}

const MAX_SIZE_MB = 10;

/**
 * Highlights any '[unclear]' tokens in the text with an eye-catching warning style.
 */
function renderHighlightedText(text: string) {
  if (!text.includes('[unclear]')) {
    return <span>{text}</span>;
  }

  const parts = text.split(/(\[unclear\])/g);
  return (
    <span>
      {parts.map((part, index) =>
        part === '[unclear]' ? (
          <span
            key={index}
            className="inline-flex items-center px-1.5 py-0.5 rounded font-bold text-xs bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 mx-0.5"
            title="Model was uncertain about this word/number due to illegibility or scan quality."
          >
            [unclear]
          </span>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
}

export function PaperImportTab({ examId, onImportCompleted }: PaperImportTabProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Extracted data state
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [importedQuestions, setImportedQuestions] = useState<ImportedQuestionItem[]>([]);

  // Editing dialog state
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_SIZE_MB * 1024 * 1024) {
      setErrorMsg(MESSAGES.uploadsAndAi.fileTooLarge.message);
      return;
    }

    const validExtensions = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.txt'];
    const lowerName = selected.name.toLowerCase();
    const isAllowed = validExtensions.some((ext) => lowerName.endsWith(ext));
    if (!isAllowed) {
      setErrorMsg(MESSAGES.uploadsAndAi.wrongFileType.message);
      return;
    }

    setFile(selected);
  };

  const handleExtract = async () => {
    if (!file) return;

    setIsExtracting(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/teacher/exams/${examId}/import`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to extract questions from paper');
      }

      setFileInfo(data.fileInfo);
      setImportedQuestions(data.questions || []);
      onImportCompleted();
    } catch (err: unknown) {
      setErrorMsg(mapApiError(err, 'Failed to extract questions. Please check the file and try again.').message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApprove = async (question: ImportedQuestionItem) => {
    const hasCorrect =
      question.correct_option &&
      question.correct_option.trim().length > 0 &&
      question.correct_option !== 'UNSET';

    if (!hasCorrect) {
      setErrorMsg(`Question ${question.number} cannot be approved without setting a correct option.`);
      return;
    }

    setApprovingId(question.id);
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/questions/${question.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_status: 'approved' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to approve question');
      }

      setImportedQuestions((prev) =>
        prev.map((q) => (q.id === question.id ? { ...q, review_status: 'approved' } : q))
      );
      onImportCompleted();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error approving question');
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveAllValid = async () => {
    const validDrafts = importedQuestions.filter(
      (q) =>
        q.review_status === 'draft' &&
        q.correct_option &&
        q.correct_option.trim().length > 0 &&
        q.correct_option !== 'UNSET'
    );

    if (validDrafts.length === 0) {
      setErrorMsg('No questions ready to approve. Please set correct options first.');
      return;
    }

    setIsExtracting(true);
    try {
      for (const q of validDrafts) {
        await fetch(`/api/teacher/exams/${examId}/questions/${q.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ review_status: 'approved' }),
        });
      }

      const validIds = new Set(validDrafts.map((q) => q.id));
      setImportedQuestions((prev) =>
        prev.map((q) => (validIds.has(q.id) ? { ...q, review_status: 'approved' } : q))
      );
      onImportCompleted();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error approving questions');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!confirm('Are you sure you want to remove this extracted question?')) return;

    try {
      const res = await fetch(`/api/teacher/exams/${examId}/questions/${questionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete question');

      setImportedQuestions((prev) => prev.filter((q) => q.id !== questionId));
      onImportCompleted();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error deleting question');
    }
  };

  const handleOpenEdit = (question: ImportedQuestionItem) => {
    setEditingQuestion({
      id: question.id,
      number: question.number,
      text: question.text,
      options: question.options,
      correct_option: question.correct_option === 'UNSET' ? 'A' : question.correct_option,
      marks: question.marks,
      topic: question.topic,
      explanation: question.explanation,
    });
    setIsEditorOpen(true);
  };

  const handleResetImport = () => {
    setFile(null);
    setFileInfo(null);
    setImportedQuestions([]);
    setErrorMsg(null);
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Upload Card (Visible if no file extracted yet) */}
      {!fileInfo && (
        <Card className="border-neutral-200/80 dark:border-neutral-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base font-semibold">
                AI Paper &amp; Document Digitizer
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-neutral-500">
              Upload a scanned test, worksheet, past paper, or photo. The AI will extract all MCQs,
              detect options, mark unclear words with [unclear], and save them as editable drafts.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-8 text-center hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
              <input
                type="file"
                id="paper-file-input"
                className="hidden"
                accept=".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
                onChange={handleFileChange}
                disabled={isExtracting}
              />

              <label htmlFor="paper-file-input" className="cursor-pointer space-y-3 block">
                <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">
                    {file ? file.name : 'Click to select or drag and drop a paper'}
                  </span>
                  <p className="text-xs text-neutral-500 mt-1">
                    Accepts PDF, DOCX (Word), PNG, and JPG up to 4MB (Vercel payload limit)
                  </p>
                </div>
              </label>

              {file && (
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleExtract}
                disabled={!file || isExtracting}
                className="text-xs shadow-sm"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Extracting Questions with Gemini...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                    Start AI Extraction
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Side-by-Side Verification Screen (Original File vs Extracted Drafts) */}
      {fileInfo && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <span>Extracted Draft Questions ({importedQuestions.length})</span>
                <Badge variant="outline" className="text-xs">
                  {importedQuestions.filter((q) => q.review_status === 'approved').length} of{' '}
                  {importedQuestions.length} Approved
                </Badge>
              </h2>
              <p className="text-xs text-neutral-500">
                Review the extracted questions against the original document on the left. Edit
                unclear text or missing correct options before approving.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetImport}
                className="text-xs h-8"
              >
                <FileUp className="w-3.5 h-3.5 mr-1" />
                Import Another File
              </Button>

              <Button
                size="sm"
                onClick={handleApproveAllValid}
                disabled={isExtracting}
                className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Approve All Ready Questions
              </Button>
            </div>
          </div>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Split View Container */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Original File Viewer */}
            <div className="lg:col-span-5 space-y-2 sticky top-4">
              <div className="flex items-center justify-between text-xs text-neutral-500 font-medium px-1">
                <span className="flex items-center gap-1.5 truncate max-w-[280px]">
                  {fileInfo.type.includes('image') ? (
                    <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  )}
                  {fileInfo.name}
                </span>
                <span>{(fileInfo.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>

              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 overflow-hidden shadow-xs h-[650px] flex items-center justify-center p-2">
                {fileInfo.type === 'application/pdf' ? (
                  <iframe
                    src={fileInfo.dataUrl}
                    title="Original PDF Document"
                    className="w-full h-full rounded-lg bg-white"
                  />
                ) : fileInfo.type.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fileInfo.dataUrl}
                    alt="Original paper scan"
                    className="max-h-full max-w-full object-contain mx-auto rounded"
                  />
                ) : (
                  <div className="p-4 text-xs text-neutral-600 dark:text-neutral-400 overflow-y-auto h-full w-full bg-white dark:bg-neutral-950 rounded">
                    <p className="font-semibold mb-2 text-neutral-900 dark:text-neutral-100">
                      DOCX Extracted Document
                    </p>
                    <p className="text-neutral-500">
                      The document content has been parsed and sent to the AI model. Refer to the
                      questions on the right to review the extracted MCQs.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Extracted Draft Questions */}
            <div className="lg:col-span-7 space-y-4">
              {importedQuestions.length === 0 ? (
                <div className="text-center py-12 text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-900/40 rounded-xl border border-dashed">
                  No questions extracted from this file.
                </div>
              ) : (
                importedQuestions.map((q) => {
                  const hasUnclear =
                    q.text.includes('[unclear]') ||
                    q.options.some((opt) => opt.text.includes('[unclear]'));

                  const hasNoCorrectOption =
                    !q.correct_option ||
                    q.correct_option.trim().length === 0 ||
                    q.correct_option === 'UNSET' ||
                    !q.options.some((opt) => opt.id === q.correct_option);

                  const isApproved = q.review_status === 'approved';

                  return (
                    <Card
                      key={q.id}
                      className={cn(
                        'border transition-colors shadow-xs',
                        isApproved
                          ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/10'
                          : hasNoCorrectOption
                            ? 'border-red-300 dark:border-red-900/70 bg-red-50/15'
                            : hasUnclear
                              ? 'border-amber-300 dark:border-amber-900/70 bg-amber-50/15'
                              : 'border-neutral-200 dark:border-neutral-800'
                      )}
                    >
                      <CardHeader className="p-4 pb-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                              Question {q.number}
                            </span>
                            <Badge variant="outline" className="text-[10px] py-0 text-blue-600">
                              Imported
                            </Badge>
                            {isApproved ? (
                              <Badge className="bg-emerald-600 text-white text-[10px] py-0">
                                Approved
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/20 text-[10px] py-0"
                              >
                                Draft
                              </Badge>
                            )}
                            <span className="text-neutral-400">•</span>
                            <span className="text-xs text-neutral-500 font-medium">
                              {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                            </span>
                            {q.topic && (
                              <Badge variant="secondary" className="text-[10px] py-0">
                                {q.topic}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Unclear Text Warning */}
                        {hasUnclear && (
                          <div className="mt-2 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-1.5 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              Unclear text detected ([unclear]) — please verify with original file
                              and edit before publishing.
                            </span>
                          </div>
                        )}

                        {/* No Correct Option Warning */}
                        {hasNoCorrectOption && (
                          <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-[11px] text-red-900 dark:text-red-200 flex items-center gap-1.5 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span>
                              Warning: No correct option set. You must edit and select a correct
                              answer.
                            </span>
                          </div>
                        )}

                        <p className="text-xs sm:text-sm font-medium text-neutral-900 dark:text-neutral-100 pt-2 leading-relaxed">
                          {renderHighlightedText(q.text)}
                        </p>
                      </CardHeader>

                      <CardContent className="p-4 pt-1 space-y-3">
                        <div className="space-y-1.5">
                          {q.options.map((opt) => {
                            const isCorrect = q.correct_option === opt.id;
                            return (
                              <div
                                key={opt.id}
                                className={cn(
                                  'flex items-center justify-between p-2 rounded-md border text-xs',
                                  isCorrect
                                    ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 font-semibold'
                                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                                      isCorrect
                                        ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100'
                                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'
                                    )}
                                  >
                                    {opt.id}
                                  </span>
                                  <span>{renderHighlightedText(opt.text)}</span>
                                </div>

                                {isCorrect && (
                                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase">
                                    Correct Option
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {q.explanation && (
                          <div className="p-2 rounded bg-neutral-100/70 dark:bg-neutral-800/40 text-[11px] text-neutral-600 dark:text-neutral-400">
                            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                              Explanation:{' '}
                            </span>
                            {renderHighlightedText(q.explanation)}
                          </div>
                        )}

                        {/* Actions Toolbar */}
                        <div className="flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800 pt-3 text-xs">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(q)}
                            className="h-7 text-xs"
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Edit Question
                          </Button>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(q.id)}
                              className="h-7 text-xs text-neutral-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete
                            </Button>

                            {!isApproved && (
                              <Button
                                size="sm"
                                onClick={() => handleApprove(q)}
                                disabled={hasNoCorrectOption || approvingId === q.id}
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                title={
                                  hasNoCorrectOption
                                    ? 'Select a correct option before approving'
                                    : 'Mark question as approved'
                                }
                              >
                                {approvingId === q.id ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                )}
                                Approve Question
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Question Editor Dialog Modal */}
      {isEditorOpen && (
        <QuestionEditorDialog
          open={isEditorOpen}
          onOpenChange={setIsEditorOpen}
          initialQuestion={editingQuestion}
          examId={examId}
          onSaved={() => {
            // Re-fetch questions to keep sync
            onImportCompleted();
            if (editingQuestion?.id) {
              setImportedQuestions((prev) =>
                prev.map((q) =>
                  q.id === editingQuestion.id
                    ? {
                        ...q,
                        text: editingQuestion.text,
                        options: editingQuestion.options,
                        correct_option: editingQuestion.correct_option,
                        marks: editingQuestion.marks,
                        topic: editingQuestion.topic || null,
                        explanation: editingQuestion.explanation || null,
                      }
                    : q
                )
              );
            }
          }}
        />
      )}
    </div>
  );
}
