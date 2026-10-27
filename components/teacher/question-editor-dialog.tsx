'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { mapApiError } from '@/lib/messages';

export interface QuestionData {
  id?: string;
  number?: number;
  text: string;
  options: { id: string; text: string }[];
  correct_option: string;
  marks: number;
  topic?: string | null;
  explanation?: string | null;
}

interface QuestionEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuestion?: QuestionData | null;
  examId: string;
  onSaved: () => void;
}

const DEFAULT_OPTIONS = [
  { id: 'A', text: '' },
  { id: 'B', text: '' },
  { id: 'C', text: '' },
  { id: 'D', text: '' },
];

function QuestionFormContent({
  initialQuestion,
  examId,
  onSaved,
  onClose,
}: {
  initialQuestion?: QuestionData | null;
  examId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialQuestion?.text || '');
  const [options, setOptions] = useState<{ id: string; text: string }[]>(
    Array.isArray(initialQuestion?.options) && initialQuestion!.options.length > 0
      ? initialQuestion!.options
      : DEFAULT_OPTIONS
  );
  const [correctOption, setCorrectOption] = useState(initialQuestion?.correct_option || 'A');
  const [marks, setMarks] = useState(String(initialQuestion?.marks || 1));
  const [topic, setTopic] = useState(initialQuestion?.topic || '');
  const [explanation, setExplanation] = useState(initialQuestion?.explanation || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOptionChange = (index: number, newText: string) => {
    const updated = [...options];
    updated[index].text = newText;
    setOptions(updated);
  };

  const handleAddOption = () => {
    const nextChar = String.fromCharCode(65 + options.length);
    setOptions([...options, { id: nextChar, text: '' }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      setErrorMsg('At least 2 options are required for an MCQ question.');
      return;
    }
    const removedId = options[index].id;
    const filtered = options.filter((_, i) => i !== index);

    const reindexed = filtered.map((opt, i) => ({
      id: String.fromCharCode(65 + i),
      text: opt.text,
    }));
    setOptions(reindexed);

    if (correctOption === removedId || !reindexed.some((o) => o.id === correctOption)) {
      setCorrectOption(reindexed[0].id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!text.trim()) {
      setErrorMsg('Question text is required.');
      return;
    }

    const filledOptions = options.map((o) => ({ id: o.id.trim(), text: o.text.trim() }));
    if (filledOptions.some((o) => !o.text)) {
      setErrorMsg('All option fields must have text.');
      return;
    }

    if (filledOptions.length < 2) {
      setErrorMsg('At least 2 options are required.');
      return;
    }

    if (!correctOption || !filledOptions.some((o) => o.id === correctOption)) {
      setErrorMsg('Please select a valid correct option.');
      return;
    }

    const marksNum = parseFloat(marks);
    if (isNaN(marksNum) || marksNum <= 0) {
      setErrorMsg('Marks must be greater than 0.');
      return;
    }

    setLoading(true);

    try {
      const isEditing = Boolean(initialQuestion?.id);
      const url = isEditing
        ? `/api/teacher/exams/${examId}/questions/${initialQuestion!.id}`
        : `/api/teacher/exams/${examId}/questions`;
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          options: filledOptions,
          correct_option: correctOption,
          marks: marksNum,
          topic: topic.trim() || null,
          explanation: explanation.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || (data.details ? JSON.stringify(data.details) : 'Failed to save question'));
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        mapApiError(err, 'Failed to save question. Please check all fields and try again.').message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {errorMsg && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="q-text">Question Text *</Label>
        <Textarea
          id="q-text"
          placeholder="e.g. Which of the following data structures operates on LIFO principle?"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      {/* Options List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Options (Mark the radio for the correct option) *</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddOption}
            disabled={loading || options.length >= 8}
            className="h-7 text-xs text-blue-600"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Choice
          </Button>
        </div>

        <div className="space-y-2.5">
          {options.map((opt, index) => {
            const isSelected = correctOption === opt.id;
            return (
              <div
                key={opt.id}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <label className="flex items-center cursor-pointer px-1">
                  <input
                    type="radio"
                    name="correct-option-group"
                    checked={isSelected}
                    onChange={() => setCorrectOption(opt.id)}
                    className="text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    disabled={loading}
                  />
                </label>

                <div className="w-6 text-center font-bold text-xs text-neutral-500">
                  {opt.id}
                </div>

                <Input
                  placeholder={`Option ${opt.id} text...`}
                  value={opt.text}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="h-8 text-xs flex-1 bg-white dark:bg-neutral-900"
                  required
                  disabled={loading}
                />

                {options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveOption(index)}
                    disabled={loading}
                    className="h-8 w-8 p-0 text-neutral-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-neutral-400">
          Selected correct answer: <span className="font-semibold text-emerald-600">Option {correctOption}</span>
        </p>
      </div>

      {/* Marks and Topic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="q-marks">Marks *</Label>
          <Input
            id="q-marks"
            type="number"
            step="0.5"
            min="0.5"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-topic">Topic (Optional)</Label>
          <Input
            id="q-topic"
            placeholder="e.g. Data Structures, Thermodynamics"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      {/* Explanation */}
      <div className="space-y-1.5">
        <Label htmlFor="q-explanation">Explanation (Optional)</Label>
        <Textarea
          id="q-explanation"
          placeholder="Explanation shown to students in post-submission review..."
          rows={2}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          disabled={loading}
        />
      </div>

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Question'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function QuestionEditorDialog({
  open,
  onOpenChange,
  initialQuestion,
  examId,
  onSaved,
}: QuestionEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialQuestion?.id ? `Edit Question #${initialQuestion.number ?? ''}` : 'Add New Question'}
          </DialogTitle>
          <DialogDescription>
            Specify question statement, multiple choices, correct answer, marks, and optional topic.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <QuestionFormContent
            key={initialQuestion?.id || 'new'}
            initialQuestion={initialQuestion}
            examId={examId}
            onSaved={onSaved}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

