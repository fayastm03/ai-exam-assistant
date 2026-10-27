'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, Save, AlertCircle, CheckCircle2, Loader2, Users, Plus } from 'lucide-react';

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

interface TeacherClass {
  id: string;
  name: string;
  join_code: string;
  approved_count: number;
  pending_count: number;
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

  // Classes multi-select state
  const [availableClasses, setAvailableClasses] = useState<TeacherClass[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load teacher's classes and currently assigned classes
  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [classesRes, assignedRes] = await Promise.all([
          fetch('/api/teacher/classes'),
          fetch(`/api/teacher/exams/${exam.id}/classes`),
        ]);

        const classesData = await classesRes.json();
        const assignedData = await assignedRes.json();

        if (!ignore) {
          if (classesRes.ok && classesData.classes) {
            setAvailableClasses(classesData.classes);
          }
          if (assignedRes.ok && assignedData.class_ids) {
            setSelectedClassIds(assignedData.class_ids);
          }
        }
      } catch (err) {
        if (!ignore) {
          setErrorMsg('Could not load classes. Please refresh the page to try again.');
        }
      } finally {
        if (!ignore) {
          setClassesLoading(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [exam.id]);

  const toggleClassSelection = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  const handleSelectAllClasses = () => {
    if (selectedClassIds.length === availableClasses.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(availableClasses.map((c) => c.id));
    }
  };

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
      // 1. Update general exam settings
      const examRes = await fetch(`/api/teacher/exams/${exam.id}`, {
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

      const examData = await examRes.json();
      if (!examRes.ok) {
        throw new Error(examData.message || 'Failed to update exam settings');
      }

      // 2. Update assigned classes
      const classesRes = await fetch(`/api/teacher/exams/${exam.id}/classes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_ids: selectedClassIds }),
      });

      const classesData = await classesRes.json();
      if (!classesRes.ok) {
        throw new Error(classesData.message || 'Failed to update class assignments');
      }

      setSuccessMsg('Exam settings and class assignments saved successfully.');
      onExamUpdated(examData.exam);
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
          Configure title, instructions, time duration, class assignments, and scheduling windows.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          {errorMsg && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs ml-2">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert className="py-2.5 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-xs ml-2">{successMsg}</AlertDescription>
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

          {/* Classes Multi-Select Section */}
          <div className="space-y-2.5 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <Label className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Assigned Classes *
                </Label>
                <Badge
                  variant={selectedClassIds.length > 0 ? 'default' : 'destructive'}
                  className="text-[11px] h-5"
                >
                  {selectedClassIds.length} Selected
                </Badge>
              </div>

              {availableClasses.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllClasses}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium text-left"
                >
                  {selectedClassIds.length === availableClasses.length
                    ? 'Deselect All'
                    : 'Select All Classes'}
                </button>
              )}
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Choose which of your classes can access and take this exam. An exam must be assigned to at least one class to be published.
            </p>

            {classesLoading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-neutral-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading your classes...
              </div>
            ) : availableClasses.length === 0 ? (
              <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                <p className="font-medium">You haven&apos;t created any classes yet.</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  You must create at least one class before students can take this exam.
                </p>
                <Link
                  href="/teacher/classes"
                  className={buttonVariants({ variant: 'outline', size: 'sm', className: 'h-7 text-xs border-amber-300' })}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Create a Class
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {availableClasses.map((cls) => {
                  const isChecked = selectedClassIds.includes(cls.id);

                  return (
                    <label
                      key={cls.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 ring-1 ring-blue-600/50'
                          : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleClassSelection(cls.id)}
                        disabled={saving}
                        className="mt-0.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs truncate">
                            {cls.name}
                          </span>
                          <span className="font-mono text-[10px] text-neutral-500 shrink-0">
                            {cls.join_code}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {cls.approved_count} approved student{cls.approved_count === 1 ? '' : 's'}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {selectedClassIds.length === 0 && availableClasses.length > 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium pt-1">
                ⚠️ Notice: No class is currently selected. Publishing will be blocked until at least one class is assigned.
              </p>
            )}
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
