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
import { toast } from '@/components/ui/toast';
import { mapApiError, MESSAGES } from '@/lib/messages';

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
      toast.success(MESSAGES.success.examDeleted);
    } catch (err: unknown) {
      toast.error(mapApiError(err, 'Failed to delete exam.').message);
    } finally {
      setDeletingId(null);
    }
  };

  const renderStatusBadge = (status: ExamListItem['status']) => {
    switch (status) {
      case 'published':
        return (
          <Badge className="bg-emerald-600 text-white font-medium text-xs rounded">
            Published
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="outline" className="text-xs font-normal border-border bg-secondary text-foreground rounded">
            Draft
          </Badge>
        );
      case 'closed':
        return (
          <Badge variant="secondary" className="text-xs font-normal text-muted-foreground rounded">
            Closed
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Exams
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, manage, and publish your examination papers.
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto rounded-lg h-9 bg-primary text-primary-foreground font-medium text-xs">
          <Plus className="w-4 h-4 mr-1.5" />
          Create Exam
        </Button>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-lg rounded-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Create New Exam</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set up initial exam details. You can add questions and adjust settings next.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateExam} className="space-y-4 pt-2">
              {createError && (
                <Alert variant="destructive" className="py-2.5 rounded-lg text-xs">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="exam-title" className="text-xs font-medium">Exam Title *</Label>
                <Input
                  id="exam-title"
                  placeholder="e.g. Physics Midterm 2026"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  required
                  disabled={createLoading}
                  className="rounded-lg h-10 text-base sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="exam-duration" className="text-xs font-medium">Duration (Minutes) *</Label>
                  <Input
                    id="exam-duration"
                    type="number"
                    min={1}
                    value={createDuration}
                    onChange={(e) => setCreateDuration(e.target.value)}
                    required
                    disabled={createLoading}
                    className="rounded-lg h-10 text-base sm:text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="exam-neg" className="text-xs font-medium">Negative Marking (0 - 1)</Label>
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
                    className="rounded-lg h-10 text-base sm:text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">0 for none, 0.25 for 25% penalty</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exam-instructions" className="text-xs font-medium">Instructions (Optional)</Label>
                <Textarea
                  id="exam-instructions"
                  placeholder="Instructions shown to students before beginning the exam..."
                  rows={3}
                  value={createInstructions}
                  onChange={(e) => setCreateInstructions(e.target.value)}
                  disabled={createLoading}
                  className="rounded-lg text-base sm:text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="exam-shuffle"
                  type="checkbox"
                  checked={createShuffle}
                  onChange={(e) => setCreateShuffle(e.target.checked)}
                  className="rounded border-border accent-primary w-4 h-4"
                  disabled={createLoading}
                />
                <Label htmlFor="exam-shuffle" className="text-xs font-normal cursor-pointer text-muted-foreground">
                  Shuffle question order for each student
                </Label>
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={createLoading}
                  className="rounded-lg h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createLoading} className="rounded-lg h-9 bg-primary text-primary-foreground text-xs font-medium">
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
        <Alert variant="destructive" className="rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{errorMsg}</span>
            <Button size="sm" variant="outline" onClick={fetchExams} className="ml-4 h-8 text-xs rounded-lg">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="rounded-lg border border-border animate-pulse shadow-sm">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-secondary rounded w-1/3" />
                <div className="h-6 bg-secondary rounded w-3/4" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-3 bg-secondary rounded w-1/2" />
                <div className="h-3 bg-secondary rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !errorMsg && exams.length === 0 && (
        <Card className="rounded-lg border border-dashed border-border py-12 text-center bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-lg bg-secondary text-primary flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="max-w-sm space-y-1">
              <CardTitle className="text-base font-semibold text-foreground">No exams yet</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Build your first exam draft, author questions manually, or use the bulk paste parser.
              </CardDescription>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="rounded-lg h-9 px-4 bg-primary text-primary-foreground text-xs font-medium">
              <Plus className="w-4 h-4 mr-1.5" />
              Create an Exam
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
              className="rounded-lg border border-border shadow-sm flex flex-col justify-between"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold text-foreground line-clamp-1 leading-snug">
                    {exam.title}
                  </CardTitle>
                  {renderStatusBadge(exam.status)}
                </div>
                {exam.instructions && (
                  <CardDescription className="text-xs line-clamp-2 pt-1 text-muted-foreground">
                    {exam.instructions}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="space-y-3 py-2 text-xs text-muted-foreground">
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{exam.question_count} {exam.question_count === 1 ? 'question' : 'questions'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{exam.duration_min} mins</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  {exam.negative_marking > 0 ? (
                    <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10 py-0 rounded text-[11px]">
                      -{Math.round(exam.negative_marking * 100)}% wrong
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground border-border py-0 rounded text-[11px]">
                      No penalty
                    </Badge>
                  )}

                  {exam.shuffle && (
                    <Badge variant="outline" className="border-border text-muted-foreground py-0 rounded text-[11px] flex items-center gap-1">
                      <Shuffle className="w-3 h-3" /> Shuffled
                    </Badge>
                  )}
                </div>

                {(exam.open_at || exam.close_at) && (
                  <div className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {exam.open_at ? new Date(exam.open_at).toLocaleDateString() : 'Now'} —{' '}
                      {exam.close_at ? new Date(exam.close_at).toLocaleDateString() : 'Open-ended'}
                    </span>
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-3 border-t border-border flex items-center justify-between gap-2">
                <Link
                  href={`/teacher/exams/${exam.id}`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1 text-xs rounded-lg h-9')}
                >
                  <Edit className="w-3.5 h-3.5 mr-1.5" />
                  Edit
                </Link>

                <Link
                  href={`/teacher/exams/${exam.id}/results`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1 text-xs rounded-lg h-9')}
                  title="View Class Results"
                >
                  <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Results
                </Link>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteExam(exam.id, exam.title)}
                  disabled={deletingId === exam.id}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9 px-2.5 rounded-lg"
                  title="Delete Exam"
                >
                  {deletingId === exam.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-destructive" />
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
