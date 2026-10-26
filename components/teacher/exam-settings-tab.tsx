'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, Save, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface ExamData {
  id: string;
  title: string;
  instructions: string | null;
  duration_min: number;
  open_at: string | null;
  close_at: string | null;
  negative_marking: number;
  shuffle: boolean;
  status: 'draft' | 'published' | 'closed';
  created_at?: string;
  updated_at?: string;
}

interface ExamSettingsTabProps {
  exam: ExamData;
  onExamUpdated: (updatedExam: ExamData) => void;
}

// Convert ISO string to format suitable for <input type="datetime-local" />: "YYYY-MM-DDTHH:mm"
const formatForInput = (isoString: string | null) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().slice(0, 16);
};

export function ExamSettingsTab({ exam, onExamUpdated }: ExamSettingsTabProps) {
  const [title, setTitle] = useState(exam.title);
  const [instructions, setInstructions] = useState(exam.instructions || '');
  const [durationMin, setDurationMin] = useState(String(exam.duration_min));
  const [negativeMarking, setNegativeMarking] = useState(String(exam.negative_marking));
  const [shuffle, setShuffle] = useState(exam.shuffle);
  const [openAt, setOpenAt] = useState(formatForInput(exam.open_at));
  const [closeAt, setCloseAt] = useState(formatForInput(exam.close_at));

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!title.trim()) {
      setErrorMsg('Exam title is required.');
      return;
    }

    const duration = parseInt(durationMin, 10);
    if (isNaN(duration) || duration <= 0) {
      setErrorMsg('Duration must be a positive integer in minutes.');
      return;
    }

    const neg = parseFloat(negativeMarking);
    if (isNaN(neg) || neg < 0) {
      setErrorMsg('Negative marking cannot be negative.');
      return;
    }

    let isoOpen: string | null = null;
    let isoClose: string | null = null;

    if (openAt) {
      isoOpen = new Date(openAt).toISOString();
    }
    if (closeAt) {
      isoClose = new Date(closeAt).toISOString();
    }

    if (isoOpen && isoClose && new Date(isoClose) < new Date(isoOpen)) {
      setErrorMsg('Close time must be later than open time.');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/teacher/exams/${exam.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          instructions: instructions.trim() || null,
          duration_min: duration,
          negative_marking: neg,
          shuffle,
          open_at: isoOpen,
          close_at: isoClose,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update exam settings');
      }

      setSuccessMsg('Exam settings saved successfully.');
      onExamUpdated(data.exam);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-neutral-200/80 dark:border-neutral-800">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Settings className="w-4 h-4 text-neutral-600" />
          Exam Configuration
        </CardTitle>
        <CardDescription className="text-xs">
          Configure title, instructions, time duration, scheduling windows, and scoring policies.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {errorMsg && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert className="py-2.5 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-xs">{successMsg}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="set-title">Exam Title *</Label>
            <Input
              id="set-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="set-instructions">Student Instructions</Label>
            <Textarea
              id="set-instructions"
              placeholder="Instructions displayed to students before starting..."
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-duration">Duration (Minutes) *</Label>
              <Input
                id="set-duration"
                type="number"
                min="1"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                required
                disabled={saving}
              />
              <p className="text-[11px] text-neutral-400">Server-enforced deadline clock</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="set-neg">Negative Marking (Fraction)</Label>
              <Input
                id="set-neg"
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={negativeMarking}
                onChange={(e) => setNegativeMarking(e.target.value)}
                disabled={saving}
              />
              <p className="text-[11px] text-neutral-400">
                e.g. 0.25 deducts 25% of question marks on wrong answers. 0 for no penalty.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-open">Open At (Optional)</Label>
              <Input
                id="set-open"
                type="datetime-local"
                value={openAt}
                onChange={(e) => setOpenAt(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="set-close">Close At (Optional)</Label>
              <Input
                id="set-close"
                type="datetime-local"
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              id="set-shuffle"
              type="checkbox"
              checked={shuffle}
              onChange={(e) => setShuffle(e.target.checked)}
              className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              disabled={saving}
            />
            <Label htmlFor="set-shuffle" className="text-sm font-medium cursor-pointer">
              Shuffle question order for each student attempt
            </Label>
          </div>
        </CardContent>

        <CardFooter className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving Changes...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1.5" />
                Save Settings
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

