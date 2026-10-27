'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppMessage } from '@/components/ui/app-message';
import { cn } from '@/lib/utils';
import {
  Clock,
  HelpCircle,
  Play,
  RotateCw,
  CheckCircle2,
  Calendar,
  BookOpen,
  Users,
  PlusCircle,
  Lock,
} from 'lucide-react';
import { mapApiError } from '@/lib/messages';

interface ExamItem {
  id: string;
  title: string;
  instructions: string | null;
  duration_min: number;
  open_at: string | null;
  close_at: string | null;
  status: 'draft' | 'published' | 'closed';
  negative_marking: number;
  question_count: number;
  class_name: string | null;
  my_attempt: {
    id: string;
    status: 'in_progress' | 'submitted' | 'auto_submitted';
    score: number | null;
    submitted_at: string | null;
  } | null;
}

export default function StudentExamsPage() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [approvedClassesCount, setApprovedClassesCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const [classesRes, examsRes] = await Promise.all([
        fetch('/api/student/classes'),
        fetch('/api/student/exams'),
      ]);

      const [classesData, examsData] = await Promise.all([
        classesRes.json(),
        examsRes.json(),
      ]);

      if (!examsRes.ok) {
        throw new Error(examsData.message || 'Failed to load exams');
      }

      setExams(examsData.exams || []);

      if (classesRes.ok && Array.isArray(classesData.classes)) {
        const approvedCount = classesData.classes.filter(
          (c: { status: string }) => c.status === 'approved'
        ).length;
        setApprovedClassesCount(approvedCount);
      } else {
        setApprovedClassesCount(0);
      }
    } catch (err: unknown) {
      setErrorMsg(mapApiError(err, 'Failed to load exams. Please try again.').message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const now = new Date();

  const availableExams = exams.filter((e) => {
    const isCompleted = e.my_attempt?.status === 'submitted' || e.my_attempt?.status === 'auto_submitted';
    const isClosed = e.status === 'closed' || (e.close_at && new Date(e.close_at) < now);
    const isUpcoming = e.open_at && new Date(e.open_at) > now;
    return !isCompleted && !isClosed && !isUpcoming;
  });

  const upcomingExams = exams.filter((e) => {
    const isCompleted = e.my_attempt?.status === 'submitted' || e.my_attempt?.status === 'auto_submitted';
    const isClosed = e.status === 'closed' || (e.close_at && new Date(e.close_at) < now);
    const isUpcoming = e.open_at && new Date(e.open_at) > now;
    return isUpcoming && !isClosed && !isCompleted;
  });

  const completedExams = exams.filter(
    (e) => e.my_attempt?.status === 'submitted' || e.my_attempt?.status === 'auto_submitted'
  );

  const closedExams = exams.filter((e) => {
    const isCompleted = e.my_attempt?.status === 'submitted' || e.my_attempt?.status === 'auto_submitted';
    const isClosed = e.status === 'closed' || (e.close_at && new Date(e.close_at) < now);
    return isClosed && !isCompleted;
  });

  const renderExamCard = (exam: ExamItem) => {
    const isCompleted = exam.my_attempt?.status === 'submitted' || exam.my_attempt?.status === 'auto_submitted';
    const isInProgress = exam.my_attempt?.status === 'in_progress';
    const isUpcoming = exam.open_at && new Date(exam.open_at) > now;
    const isClosed = exam.status === 'closed' || (exam.close_at && new Date(exam.close_at) < now);
    const isAvailable = !isCompleted && !isClosed && !isUpcoming;

    return (
      <Card
        key={exam.id}
        className="rounded-lg border border-border shadow-sm bg-card flex flex-col justify-between"
      >
        <CardHeader className="p-5 pb-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            {exam.class_name ? (
              <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                {exam.class_name}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">General</span>
            )}

            {isCompleted ? (
              <Badge variant="outline" className="text-xs font-medium border-success/40 text-success bg-success/10 rounded-lg">
                Completed
              </Badge>
            ) : isInProgress ? (
              <Badge variant="outline" className="text-xs font-medium border-warning/40 text-warning bg-warning/10 rounded-lg">
                In Progress
              </Badge>
            ) : isUpcoming ? (
              <Badge variant="outline" className="text-xs font-medium border-info/40 text-info bg-info/10 rounded-lg">
                Upcoming
              </Badge>
            ) : isClosed ? (
              <Badge variant="outline" className="text-xs font-medium border-border text-muted-foreground rounded-lg">
                Closed
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs font-medium border-primary/40 text-primary bg-primary/10 rounded-lg">
                Available
              </Badge>
            )}
          </div>

          <CardTitle className="text-base font-semibold leading-snug line-clamp-1">
            {exam.title}
          </CardTitle>

          {exam.instructions && (
            <CardDescription className="text-xs line-clamp-2">
              {exam.instructions}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="px-5 py-2 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              {exam.question_count} questions
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {exam.duration_min} mins
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {exam.negative_marking > 0 ? (
              <span className="text-[11px] text-destructive font-medium">
                -{Math.round(exam.negative_marking * 100)}% negative marking
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                No negative marking
              </span>
            )}

            {isCompleted && exam.my_attempt?.score !== null && (
              <span className="text-xs font-semibold text-foreground ml-auto">
                Score: {exam.my_attempt?.score}
              </span>
            )}
          </div>

          {isUpcoming && exam.open_at && (
            <p className="text-xs text-info pt-1 inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Opens {new Date(exam.open_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}

          {isAvailable && exam.close_at && (
            <p className="text-xs text-muted-foreground pt-1 inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Closes {new Date(exam.close_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </p>
          )}
        </CardContent>

        <CardFooter className="p-5 pt-3 border-t border-border">
          {isCompleted ? (
            <Link
              href={`/exams/${exam.id}/result`}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'w-full h-9 text-xs rounded-lg font-medium'
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-success" />
              View Results
            </Link>
          ) : isInProgress ? (
            <Link
              href={`/exams/${exam.id}/take`}
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                'w-full h-9 text-xs rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium'
              )}
            >
              <RotateCw className="w-3.5 h-3.5 mr-1.5" />
              Resume Exam
            </Link>
          ) : isAvailable ? (
            <Link
              href={`/exams/${exam.id}`}
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                'w-full h-9 text-xs rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium'
              )}
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Start Exam
            </Link>
          ) : isUpcoming ? (
            <Button
              disabled
              variant="outline"
              size="sm"
              className="w-full h-9 text-xs rounded-lg text-muted-foreground cursor-not-allowed"
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              Opens {exam.open_at ? new Date(exam.open_at).toLocaleDateString() : 'soon'}
            </Button>
          ) : (
            <Button
              disabled
              variant="outline"
              size="sm"
              className="w-full h-9 text-xs rounded-lg text-muted-foreground cursor-not-allowed"
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              Closed
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Exams</h1>
          <p className="text-sm text-muted-foreground">
            Exams published for your enrolled classes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchExams}
            disabled={loading}
            className="h-9 text-xs rounded-lg cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Link
            href="/join"
            className={cn(
              buttonVariants({ variant: 'default', size: 'sm' }),
              'h-9 text-xs rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium'
            )}
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
            Join Class
          </Link>
        </div>
      </div>

      {errorMsg && <AppMessage message={errorMsg} type="error" />}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-lg border border-border bg-card p-5 space-y-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-5 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2 pt-2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State 1: No approved classes */}
      {!loading && !errorMsg && approvedClassesCount === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-3 bg-card">
          <div className="w-12 h-12 rounded-lg bg-secondary text-primary mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h2 className="text-base font-semibold text-foreground">Join a class to access exams</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              No exams yet. Ask your teacher for a class code to get started.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/join"
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                'h-9 text-xs rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium'
              )}
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
              Join a Class
            </Link>
          </div>
        </div>
      )}

      {/* Empty State 2: In class, but no exams */}
      {!loading && !errorMsg && approvedClassesCount !== null && approvedClassesCount > 0 && exams.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-3 bg-card">
          <div className="w-12 h-12 rounded-lg bg-secondary text-muted-foreground mx-auto flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h2 className="text-base font-semibold text-foreground">No exams scheduled</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your teachers have not published any exams for your classes yet.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchExams} className="h-9 text-xs rounded-lg">
              <RotateCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
            <Link
              href="/classes"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-9 text-xs rounded-lg')}
            >
              View My Classes
            </Link>
          </div>
        </div>
      )}

      {!loading && exams.length > 0 && (
        <div className="space-y-8">
          {availableExams.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Available Exams</h2>
                <Badge variant="outline" className="text-xs font-semibold px-2 py-0 border-primary/40 text-primary bg-primary/10 rounded-lg">
                  {availableExams.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableExams.map(renderExamCard)}
              </div>
            </div>
          )}

          {upcomingExams.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Upcoming Exams</h2>
                <Badge variant="outline" className="text-xs font-semibold px-2 py-0 border-info/40 text-info bg-info/10 rounded-lg">
                  {upcomingExams.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingExams.map(renderExamCard)}
              </div>
            </div>
          )}

          {completedExams.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Completed Exams</h2>
                <Badge variant="outline" className="text-xs font-semibold px-2 py-0 border-success/40 text-success bg-success/10 rounded-lg">
                  {completedExams.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedExams.map(renderExamCard)}
              </div>
            </div>
          )}

          {closedExams.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Closed Exams</h2>
                <Badge variant="outline" className="text-xs font-semibold px-2 py-0 border-border text-muted-foreground rounded-lg">
                  {closedExams.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {closedExams.map(renderExamCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
