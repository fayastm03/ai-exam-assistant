'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  Users,
  PlusCircle,
  Clock,
  XCircle,
  AlertCircle,
  BookOpen,
  ArrowRight,
  RotateCw,
  UserCheck,
  Calendar,
} from 'lucide-react';
import { mapApiError } from '@/lib/messages';

interface StudentClassItem {
  membership_id: string;
  class_id: string;
  class_name: string;
  teacher_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  requested_at: string;
  decided_at: string | null;
  created_at: string | null;
}

interface StudentExamItem {
  id: string;
  title: string;
  class_name?: string;
  class_names?: string[];
  timing_status: 'upcoming' | 'available' | 'closed' | 'completed';
}

export default function MyClassesPage() {
  const [classes, setClasses] = useState<StudentClassItem[]>([]);
  const [exams, setExams] = useState<StudentExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [classesRes, examsRes] = await Promise.all([
          fetch('/api/student/classes', { cache: 'no-store' }),
          fetch('/api/student/exams', { cache: 'no-store' }),
        ]);

        const classesData = await classesRes.json();
        const examsData = await examsRes.json();

        if (!ignore) {
          if (!classesRes.ok) {
            throw new Error(classesData.message || 'Failed to load your classes');
          }

          setClasses(classesData.classes || []);
          if (examsRes.ok) {
            setExams(examsData.exams || []);
          }
          setErrorMsg(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setErrorMsg(mapApiError(err, 'Failed to load classes. Please try again.').message);
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

  // Helper to count available exams for an approved class
  const getAvailableExamsCount = (className: string) => {
    return exams.filter((e) => {
      const matchesClass =
        e.class_name === className ||
        (e.class_names && e.class_names.includes(className));
      return matchesClass && e.timing_status === 'available';
    }).length;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header with Title and "Join another class" action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            My Classes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View your enrolled classes and membership status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/join"
            className={cn(
              buttonVariants({ variant: 'default', size: 'sm' }),
              'w-full sm:w-auto text-xs font-medium rounded-lg h-9 px-3.5 bg-primary text-primary-foreground'
            )}
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Join a Class
          </Link>
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <Alert variant="destructive" className="rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{errorMsg}</span>
            <Button size="sm" variant="outline" onClick={fetchData} className="ml-4 h-8 text-xs rounded-lg">
              <RotateCw className="w-3.5 h-3.5 mr-1" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading state skeleton */}
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

      {/* Empty state: Student has not joined any classes yet */}
      {!loading && !errorMsg && classes.length === 0 && (
        <Card className="rounded-lg border border-dashed border-border py-12 text-center bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-lg bg-secondary text-primary flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div className="max-w-sm space-y-1">
              <CardTitle className="text-base font-semibold text-foreground">No classes yet</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Ask your teacher for a 6-character class code to join.
              </CardDescription>
            </div>
            <Link
              href="/join"
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'text-xs font-medium rounded-lg h-9 px-4 bg-primary text-primary-foreground')}
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
              Join a Class
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Class Membership Cards */}
      {!loading && classes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((cls) => {
            const availableExamsCount =
              cls.status === 'approved' ? getAvailableExamsCount(cls.class_name) : 0;

            return (
              <Card
                key={cls.membership_id}
                className="rounded-lg border border-border shadow-sm flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold text-foreground line-clamp-1 leading-snug">
                      {cls.class_name}
                    </CardTitle>

                    {/* Status Badges */}
                    {cls.status === 'approved' && (
                      <Badge className="bg-emerald-600 text-white font-medium text-xs rounded">
                        Approved
                      </Badge>
                    )}
                    {cls.status === 'pending' && (
                      <Badge
                        variant="outline"
                        className="border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-500/10 text-xs font-medium rounded"
                      >
                        Pending
                      </Badge>
                    )}
                    {cls.status === 'rejected' && (
                      <Badge
                        variant="outline"
                        className="border-destructive/40 text-destructive bg-destructive/10 text-xs font-medium rounded"
                      >
                        Declined
                      </Badge>
                    )}
                    {cls.status === 'removed' && (
                      <Badge
                        variant="outline"
                        className="border-border text-muted-foreground bg-secondary text-xs font-medium rounded"
                      >
                        Removed
                      </Badge>
                    )}
                  </div>

                  <CardDescription className="text-xs pt-1 flex items-center gap-1.5 text-muted-foreground">
                    <UserCheck className="w-3.5 h-3.5" />
                    Teacher: <span className="font-medium text-foreground">{cls.teacher_name}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 py-2 text-xs text-muted-foreground">
                  {/* Status-specific descriptions */}
                  {cls.status === 'pending' && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-center gap-2 text-xs">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Waiting for teacher approval</span>
                    </div>
                  )}

                  {cls.status === 'rejected' && (
                    <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2 text-xs">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>Join request was declined</span>
                    </div>
                  )}

                  {cls.status === 'removed' && (
                    <div className="p-2.5 rounded-lg bg-secondary text-muted-foreground flex items-center gap-2 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Membership removed</span>
                    </div>
                  )}

                  {cls.status === 'approved' && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="font-medium">
                          {availableExamsCount === 1
                            ? '1 available exam'
                            : `${availableExamsCount} available exams`}
                        </span>
                      </div>
                      {availableExamsCount > 0 && (
                        <Link
                          href="/exams"
                          className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center"
                        >
                          View <ArrowRight className="w-3 h-3 ml-0.5" />
                        </Link>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    <span>Requested {new Date(cls.requested_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t border-border">
                  {cls.status === 'approved' ? (
                    <Link
                      href="/exams"
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        'w-full text-xs rounded-lg h-9'
                      )}
                    >
                      <BookOpen className="w-3.5 h-3.5 mr-1.5 text-primary" />
                      View Exams
                    </Link>
                  ) : cls.status === 'removed' ? (
                    <Link
                      href="/join"
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        'w-full text-xs rounded-lg h-9'
                      )}
                    >
                      <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                      Re-request with Code
                    </Link>
                  ) : (
                    <div className="w-full text-center py-1 text-xs text-muted-foreground">
                      {cls.status === 'pending' ? 'Pending approval' : 'Access closed'}
                    </div>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
