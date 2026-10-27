'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Upload,
  FileText,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Layers,
  ArrowRight,
  X,
} from 'lucide-react';

interface GenerateNotesTabProps {
  examId: string;
  onGenerated: () => void;
  onNavigateToQuestions?: () => void;
}

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB (Vercel payload limit)
const MAX_TEXT_LENGTH = 50000;

export function GenerateNotesTab({
  examId,
  onGenerated,
  onNavigateToQuestions,
}: GenerateNotesTabProps) {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [count, setCount] = useState<number>(5);
  const [level, setLevel] = useState<'easy' | 'medium' | 'hard'>('medium');

  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ count: number; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setIsRateLimited(false);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg('File exceeds the 4MB limit (Vercel request limit is 4.5MB). Please upload a smaller document.');
      return;
    }

    const name = file.name.toLowerCase();
    const validExts = ['.pdf', '.docx', '.png', '.jpg', '.jpeg'];
    if (!validExts.some((ext) => name.endsWith(ext))) {
      setErrorMsg('Only PDF, DOCX, PNG, and JPG files are supported.');
      return;
    }

    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    setErrorMsg(null);
    setIsRateLimited(false);
    setSuccessInfo(null);

    const trimmedText = text.trim();
    if (!selectedFile && !trimmedText) {
      setErrorMsg('Please paste some text notes or upload a document/photo to generate questions from.');
      return;
    }

    if (trimmedText.length > MAX_TEXT_LENGTH) {
      setErrorMsg(`Text is too long (${trimmedText.length} characters). Limit is ${MAX_TEXT_LENGTH.toLocaleString()} characters.`);
      return;
    }

    setGenerating(true);

    try {
      let res: Response;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('count', String(count));
        formData.append('level', level);
        formData.append('text', trimmedText);
        formData.append('file', selectedFile);

        res = await fetch(`/api/teacher/exams/${examId}/generate`, {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch(`/api/teacher/exams/${examId}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            count,
            level,
            text: trimmedText,
          }),
        });
      }

      const data = await res.json();

      if (res.status === 429) {
        setIsRateLimited(true);
        setErrorMsg('AI rate limit reached. The AI provider is busy. Please wait 30 seconds and try again.');
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || 'Failed to generate questions');
      }

      setSuccessInfo({
        count: data.data?.count || count,
        message: data.message || 'Questions generated successfully!',
      });

      // Clear input fields on success
      setText('');
      handleRemoveFile();

      // Trigger parent reload
      onGenerated();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred during question generation.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="border-neutral-200/80 dark:border-neutral-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Generate Questions from Notes</CardTitle>
              <CardDescription>
                Paste your lecture notes or upload lecture slides, PDF, DOCX, or handwritten photos. The AI will draft MCQs with 4 options and detailed explanations.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Rate Limit Alert */}
          {isRateLimited && (
            <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="font-semibold">AI Rate Limited</AlertTitle>
              <AlertDescription className="text-xs">
                The Gemini AI rate limit was exceeded. Your request will succeed once the quota resets in a few moments. Please wait 30 seconds before retrying.
              </AlertDescription>
            </Alert>
          )}

          {/* General Error Alert */}
          {errorMsg && !isRateLimited && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Generation Error</AlertTitle>
              <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Success Banner */}
          {successInfo && (
            <Alert className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="font-semibold text-emerald-800 dark:text-emerald-300">
                Generated {successInfo.count} Draft Questions
              </AlertTitle>
              <AlertDescription className="text-xs flex items-center justify-between gap-4 mt-1">
                <span>
                  All questions have been saved as <strong>drafts</strong>. You can review, edit, and approve them before publishing.
                </span>
                {onNavigateToQuestions && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onNavigateToQuestions}
                    className="h-7 text-xs bg-white dark:bg-neutral-900 border-emerald-300 text-emerald-700 hover:bg-emerald-50 shrink-0"
                  >
                    View in Questions List <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Parameters row: Count & Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg border border-neutral-200/60 dark:border-neutral-800">
            {/* Question Count */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="count-select" className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Number of Questions
                </Label>
                <Badge variant="secondary" className="text-[10px] py-0">
                  {count} {count === 1 ? 'question' : 'questions'}
                </Badge>
              </div>
              <select
                id="count-select"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                disabled={generating}
                className="w-full text-xs h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 font-medium focus:ring-1 focus:ring-purple-500"
              >
                {[1, 2, 3, 5, 8, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'Question' : 'Questions'}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-neutral-500">Max 20 questions per generation batch.</p>
            </div>

            {/* Difficulty Level */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Target Difficulty Level
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'medium', 'hard'] as const).map((lvl) => {
                  const isSelected = level === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      disabled={generating}
                      onClick={() => setLevel(lvl)}
                      className={`text-xs font-medium py-1.5 px-2 rounded-md border text-center capitalize transition-colors ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold ring-1 ring-purple-500'
                          : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-neutral-500">
                {level === 'easy' && 'Focuses on definitions and direct factual recall.'}
                {level === 'medium' && 'Tests conceptual understanding and application.'}
                {level === 'hard' && 'Multi-step reasoning, calculations, and analytical problems.'}
              </p>
            </div>
          </div>

          {/* Section 1: Paste Text Notes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes-text" className="text-xs font-semibold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-neutral-500" />
                Paste Text Notes or Syllabus Points
              </Label>
              <span className={`text-[11px] ${text.length > MAX_TEXT_LENGTH ? 'text-red-500 font-semibold' : 'text-neutral-400'}`}>
                {text.length.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()} chars
              </span>
            </div>
            <Textarea
              id="notes-text"
              placeholder="Paste lecture notes, textbook excerpts, summary points, or syllabus topics here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={generating}
              rows={6}
              className="text-xs font-mono resize-y"
            />
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
            <span className="flex-shrink mx-4 text-xs font-medium text-neutral-400 uppercase tracking-wider">
              OR Upload Document / Photo
            </span>
            <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
          </div>

          {/* Section 2: Upload File */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-neutral-500" />
              Upload Reference Document (PDF, DOCX, PNG, JPG)
            </Label>

            {selectedFile ? (
              <div className="flex items-center justify-between p-3 rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-900/60 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={generating}
                  className="h-7 w-7 p-0 text-neutral-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-purple-400 dark:hover:border-purple-600 rounded-lg p-5 text-center cursor-pointer transition-colors"
              >
                <Upload className="w-6 h-6 mx-auto text-neutral-400 mb-1.5" />
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Click to select a document or photo
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Supports PDF, Word (.docx), PNG, JPG (up to 4MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Action button */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>
                Generated questions are saved with <code>source: generated</code> and <code>status: draft</code>.
              </span>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating || (!selectedFile && !text.trim())}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs h-9 px-4"
            >
              {generating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Generating {count} Questions...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-2" />
                  Generate {count} {level.toUpperCase()} Questions
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

