'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ParsedQuestionDraft } from '@/lib/bulk-parser';
import {
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Upload,
  Loader2,
} from 'lucide-react';

interface BulkPasteTabProps {
  examId: string;
  onQuestionsAdded: () => void;
}

const SAMPLE_BULK_TEXT = `Q: Which data structure uses FIFO (First In First Out)?
A) Stack
B) Queue *
C) Tree
D) Graph
Topic: Data Structures
Marks: 2
Explanation: A queue is an ordered collection where elements are added at the rear and removed from the front.

Q: What is the time complexity of binary search on a sorted array of N elements?
A) O(1)
B) O(N)
C) O(log N) *
D) O(N log N)
Topic: Algorithms
Marks: 2
Explanation: Binary search halves the search space at each iteration.`;

export function BulkPasteTab({ examId, onQuestionsAdded }: BulkPasteTabProps) {
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ParsedQuestionDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleParse = async () => {
    if (!rawText.trim()) {
      setParseError('Please paste or enter question text first.');
      return;
    }

    setParsing(true);
    setParseError(null);
    setSaveSuccessMsg(null);

    try {
      const res = await fetch('/api/teacher/questions/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to parse questions');
      }

      setDrafts(data.questions || []);
      if (!data.questions || data.questions.length === 0) {
        setParseError('No questions could be recognized from the text. Check formatting below.');
      }
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Error parsing text');
    } finally {
      setParsing(false);
    }
  };

  const handleRemoveDraft = (index: number) => {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateDraft = (index: number, updated: Partial<ParsedQuestionDraft>) => {
    setDrafts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updated };
      return copy;
    });
  };

  const handleSaveAllDrafts = async () => {
    const validDrafts = drafts.filter((d) => d.isValid);
    if (validDrafts.length === 0) {
      setParseError('No valid question drafts to save. Please resolve errors first.');
      return;
    }

    setSaving(true);
    setParseError(null);
    setSaveSuccessMsg(null);
    setSaveProgress({ current: 0, total: validDrafts.length });

    let savedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < validDrafts.length; i++) {
      const d = validDrafts[i];
      setSaveProgress({ current: i + 1, total: validDrafts.length });

      try {
        const res = await fetch(`/api/teacher/exams/${examId}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: d.text,
            options: d.options,
            correct_option: d.correct_option,
            marks: d.marks,
            topic: d.topic || null,
            explanation: d.explanation || null,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          errors.push(`Question #${d.number}: ${errData.message || 'Failed to save'}`);
        } else {
          savedCount++;
        }
      } catch (err: unknown) {
        errors.push(`Question #${d.number}: ${err instanceof Error ? err.message : 'Network error'}`);
      }
    }

    setSaving(false);
    setSaveProgress(null);

    if (savedCount > 0) {
      setSaveSuccessMsg(`Successfully saved ${savedCount} question${savedCount === 1 ? '' : 's'} to the exam!`);
      // Remove saved drafts
      setDrafts([]);
      setRawText('');
      onQuestionsAdded();
    }

    if (errors.length > 0) {
      setParseError(`Failed to save ${errors.length} question(s):\n${errors.join('\n')}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Box Card */}
      <Card className="border-neutral-200/80 dark:border-neutral-800">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Bulk Question Parser
              </CardTitle>
              <CardDescription className="text-xs">
                Paste questions in standard text format. An asterisk (<strong>*</strong>) marks the correct choice.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRawText(SAMPLE_BULK_TEXT)}
              className="text-xs self-start sm:self-auto h-7"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
              Load Sample Format
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {parseError && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs whitespace-pre-line">{parseError}</AlertDescription>
            </Alert>
          )}

          {saveSuccessMsg && (
            <Alert className="py-2.5 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-xs font-medium">{saveSuccessMsg}</AlertDescription>
            </Alert>
          )}

          <Textarea
            placeholder={`Q: What is 2 + 2?\nA) 3\nB) 4 *\nC) 5\nTopic: Math\nMarks: 2\nExplanation: 2 + 2 = 4\n\nQ: Next question...`}
            rows={10}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            disabled={parsing || saving}
            className="font-mono text-xs leading-relaxed"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-neutral-400">
              Format: <code>Q: ...</code>, <code>A) ...</code>, <code>B) ... *</code> (correct),{' '}
              <code>Topic: ...</code>, <code>Marks: ...</code>
            </div>

            <Button onClick={handleParse} disabled={parsing || saving || !rawText.trim()} size="sm">
              {parsing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Parse Drafts
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Editable Drafts Review Section */}
      {drafts.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900 rounded-xl">
            <div>
              <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <span>Parsed {drafts.length} Question Draft{drafts.length === 1 ? '' : 's'}</span>
                <Badge variant="outline" className="bg-white text-blue-700 text-xs">
                  {drafts.filter((d) => d.isValid).length} Valid
                </Badge>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Review and modify drafts below before committing them to the exam.
              </p>
            </div>

            <Button
              onClick={handleSaveAllDrafts}
              disabled={saving || drafts.every((d) => !d.isValid)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              size="sm"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving {saveProgress?.current} of {saveProgress?.total}...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-1.5" />
                  Save {drafts.filter((d) => d.isValid).length} Questions to Exam
                </>
              )}
            </Button>
          </div>

          <div className="space-y-3">
            {drafts.map((draft, idx) => (
              <Card
                key={idx}
                className={`transition-colors border ${
                  draft.isValid
                    ? 'border-neutral-200 dark:border-neutral-800'
                    : 'border-red-300 dark:border-red-900/60 bg-red-50/20'
                }`}
              >
                <CardHeader className="py-3 px-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                        #{draft.number}
                      </span>
                      {draft.topic && (
                        <Badge variant="secondary" className="text-[10px] py-0">
                          {draft.topic}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] py-0">
                        {draft.marks} {draft.marks === 1 ? 'Mark' : 'Marks'}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      {!draft.isValid && (
                        <Badge variant="destructive" className="text-[10px]">
                          Needs Attention
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDraft(idx)}
                        className="h-7 w-7 p-0 text-neutral-400 hover:text-red-600"
                        title="Remove Draft"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {!draft.isValid && draft.errors.length > 0 && (
                    <div className="text-[11px] text-red-600 dark:text-red-400 pt-1">
                      {draft.errors.join(' • ')}
                    </div>
                  )}
                </CardHeader>

                <CardContent className="py-2 px-4 space-y-3">
                  <div>
                    <Label className="text-[11px] text-neutral-500">Question Statement</Label>
                    <Input
                      value={draft.text}
                      onChange={(e) => handleUpdateDraft(idx, { text: e.target.value })}
                      className="text-xs h-8 mt-1"
                    />
                  </div>

                  {/* Options */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-neutral-500">
                      Options (Selected correct: <strong>Option {draft.correct_option || 'None'}</strong>)
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {draft.options.map((opt, optIdx) => {
                        const isCorrect = draft.correct_option === opt.id;
                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs ${
                              isCorrect
                                ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20'
                                : 'border-neutral-200 dark:border-neutral-800'
                            }`}
                          >
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name={`draft-correct-${idx}`}
                                checked={isCorrect}
                                onChange={() => handleUpdateDraft(idx, { correct_option: opt.id, isValid: true, errors: [] })}
                                className="text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                              />
                            </label>
                            <span className="font-bold text-[11px] w-4 text-center">{opt.id}</span>
                            <Input
                              value={opt.text}
                              onChange={(e) => {
                                const newOpts = [...draft.options];
                                newOpts[optIdx].text = e.target.value;
                                handleUpdateDraft(idx, { options: newOpts });
                              }}
                              className="h-7 text-xs flex-1 bg-white dark:bg-neutral-900"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {draft.explanation && (
                    <div className="text-[11px] text-neutral-500 bg-neutral-50 dark:bg-neutral-900 p-2 rounded border border-neutral-100 dark:border-neutral-800">
                      <span className="font-medium">Explanation:</span> {draft.explanation}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
