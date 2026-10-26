'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plus,
  Clock,
  HelpCircle,
  AlertCircle,
  Trash2,
  Edit,
  Shuffle,
  Calendar,
  Loader2,
  BookOpen,
  BarChart3,
} from 'lucide-react';

interface ExamListItem {
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
  question_count: number;
  created_at: string;
  updated_at: string;
}

export default function TeacherExamsPage() {
  const router = useRouter();

  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Create Exam Dialog State
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createInstructions, setCreateInstructions] = useState('');
  const [createDuration, setCreateDuration] = useState('30');
  const [createNegative, setCreateNegative] = useState('0');
  const [createShuffle, setCreateShuffle] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const fetchExams = useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const res = await fetch('/api/teacher/exams', { cache: 'no-store' });
        const data = await res.json();
        if (!ignore) {
          if (!res.ok) throw new Error(data.message || 'Failed to fetch exams');
          setExams(data.exams || []);
          setErrorMsg(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setErrorMsg(err instanceof Error ? err.message : 'Error loading exams');
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
  }, [refreshKey]);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);

    const durationNum = parseInt(createDuration, 10);
    if (isNaN(durationNum) || durationNum <= 0) {
      setCreateError('Duration must be a positive number of minutes.');
      setCreateLoading(false);
      return;
    }

    const negativeNum = parseFloat(createNegative) || 0;
    if (negativeNum < 0) {
      setCreateError('Negative marking fraction cannot be negative.');
      setCreateLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/teacher/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createTitle.trim(),
          instructions: createInstructions.trim() || null,
          duration_min: durationNum,
          negative_marking: negativeNum,
          shuffle: createShuffle,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create exam');
      }

      setCreateOpen(false);
      setCreateTitle('');
      setCreateInstructions('');
      setCreateDuration('30');
      setCreateNegative('0');
      setCreateShuffle(false);

      // Navigate directly to the editor for this new exam
      router.push(`/teacher/exams/${data.exam.id}`);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Error creating exam');
      setCreateLoading(false);
    }
  };

  const handleDeleteExam = async (examId: string, examTitle: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${examTitle}" and all its questions?`)) {
      return;
    }

    setDeletingId(examId);
    try {
      const res = await fetch(`/api/teacher/exams/${examId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete exam');
      }
      setExams((prev) => prev.filter((e) => e.id !== examId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete exam');
    } finally {
      setDeletingId(null);
    }
  };

  const renderStatusBadge = (status: ExamListItem['status']) => {
    switch (status) {
      case 'published':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs">
            Published
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 text-xs font-medium">
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Exam Management
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Create, edit, and publish MCQ exams with automated server evaluation
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          Create Exam
        </Button>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Exam</DialogTitle>
              <DialogDescription>
                Set up initial exam details. You can add questions and adjust settings next.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateExam} className="space-y-4 pt-2">
              {createError && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{createError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="exam-title">Exam Title *</Label>
                <Input
                  id="exam-title"
                  placeholder="e.g. Physics Midterm 2026"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  required
                  disabled={createLoading}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="exam-duration">Duration (Minutes) *</Label>
                  <Input
                    id="exam-duration"
                    type="number"
                    min={1}
                    value={createDuration}
                    onChange={(e) => setCreateDuration(e.target.value)}
                    required
                    disabled={createLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="exam-neg">Negative Marking (0 - 1)</Label>
                  <Input
                    id="exam-neg"
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    placeholder="e.g. 0.25 for 25%"
                    value={createNegative}
                    onChange={(e) => setCreateNegative(e.target.value)}
                    disabled={createLoading}
                  />
                  <p className="text-[11px] text-neutral-400">0 for none, 0.25 for 1/4 marks penalty</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exam-instructions">Instructions (Optional)</Label>
                <Textarea
                  id="exam-instructions"
                  placeholder="Instructions shown to students before beginning the exam..."
                  rows={3}
                  value={createInstructions}
                  onChange={(e) => setCreateInstructions(e.target.value)}
                  disabled={createLoading}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="exam-shuffle"
                  type="checkbox"
                  checked={createShuffle}
                  onChange={(e) => setCreateShuffle(e.target.checked)}
                  className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  disabled={createLoading}
                />
                <Label htmlFor="exam-shuffle" className="text-xs font-normal cursor-pointer">
                  Shuffle question order for each student
                </Label>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={createLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create & Add Questions'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error state */}
      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{errorMsg}</span>
            <Button size="sm" variant="outline" onClick={fetchExams} className="ml-4 h-7 text-xs">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3" />
                <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2" />
                <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !errorMsg && exams.length === 0 && (
        <Card className="border-dashed py-12 text-center bg-neutral-50/50 dark:bg-neutral-900/50">
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-7 h-7" />
            </div>
            <div className="max-w-sm space-y-1">
              <CardTitle className="text-lg">No exams created yet</CardTitle>
              <CardDescription className="text-xs">
                Build your first exam draft, author questions manually, or use the bulk paste parser.
              </CardDescription>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Exam
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Exam Grid */}
      {!loading && exams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {exams.map((exam) => (
            <Card
              key={exam.id}
              className="flex flex-col justify-between hover:shadow-md transition-shadow border-neutral-200/80 dark:border-neutral-800"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold line-clamp-1 leading-snug">
                    {exam.title}
                  </CardTitle>
                  {renderStatusBadge(exam.status)}
                </div>
                {exam.instructions && (
                  <CardDescription className="text-xs line-clamp-2 pt-1">
                    {exam.instructions}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="space-y-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                    <span>{exam.question_count} {exam.question_count === 1 ? 'Question' : 'Questions'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>{exam.duration_min} mins</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  {exam.negative_marking > 0 ? (
                    <Badge variant="outline" className="border-red-300 text-red-600 dark:border-red-900 bg-red-50/50 py-0">
                      -{Math.round(exam.negative_marking * 100)}% Wrong
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-neutral-500 py-0">
                      No Negative Marking
                    </Badge>
                  )}

                  {exam.shuffle && (
                    <Badge variant="outline" className="border-purple-300 text-purple-600 dark:border-purple-900 bg-purple-50/50 py-0 flex items-center gap-1">
                      <Shuffle className="w-2.5 h-2.5" /> Shuffled
                    </Badge>
                  )}
                </div>

                {(exam.open_at || exam.close_at) && (
                  <div className="text-[11px] text-neutral-500 pt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {exam.open_at ? new Date(exam.open_at).toLocaleDateString() : 'Now'} —{' '}
                      {exam.close_at ? new Date(exam.close_at).toLocaleDateString() : 'Open-ended'}
                    </span>
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-3 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between gap-2">
                <Link
                  href={`/teacher/exams/${exam.id}`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1 text-xs')}
                >
                  <Edit className="w-3.5 h-3.5 mr-1.5" />
                  Edit
                </Link>

                <Link
                  href={`/teacher/exams/${exam.id}/results`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1 text-xs')}
                  title="View Class Results"
                >
                  <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  Results
                </Link>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteExam(exam.id, exam.title)}
                  disabled={deletingId === exam.id}
                  className="text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 h-8 px-2"
                  title="Delete Exam"
                >
                  {deletingId === exam.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
