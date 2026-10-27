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
          setErrorMsg(err instanceof Error ? err.message : 'Error loading classes');
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
    <div className="space-y-6">
      {/* Header with Title and "Join another class" action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            My Classes
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            View your class enrollments and membership statuses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/join"
            className={cn(
              buttonVariants({ variant: 'default', size: 'sm' }),
              'w-full sm:w-auto text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white'
            )}
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Join another class
          </Link>
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{errorMsg}</span>
            <Button size="sm" variant="outline" onClick={fetchData} className="ml-4 h-7 text-xs">
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

      {/* Empty state: Student has not joined any classes yet */}
      {!loading && !errorMsg && classes.length === 0 && (
        <Card className="border-dashed py-12 text-center bg-neutral-50/50 dark:bg-neutral-900/50">
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <Users className="w-7 h-7" />
            </div>
            <div className="max-w-sm space-y-1">
              <CardTitle className="text-lg">No classes joined yet</CardTitle>
              <CardDescription className="text-xs">
                You are not enrolled in any classes. Enter the 6-character join code provided by your instructor to get started.
              </CardDescription>
            </div>
            <Link
              href="/join"
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'text-xs font-medium')}
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
                className="flex flex-col justify-between hover:shadow-md transition-shadow border-neutral-200/80 dark:border-neutral-800"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold line-clamp-1 leading-snug">
                      {cls.class_name}
                    </CardTitle>

                    {/* Status Badges */}
                    {cls.status === 'approved' && (
                      <Badge className="bg-emerald-600 text-white font-medium text-xs">
                        Approved
                      </Badge>
                    )}
                    {cls.status === 'pending' && (
                      <Badge
                        variant="outline"
                        className="border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 text-xs font-medium"
                      >
                        Pending
                      </Badge>
                    )}
                    {cls.status === 'rejected' && (
                      <Badge
                        variant="outline"
                        className="border-red-400 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 text-xs font-medium"
                      >
                        Rejected
                      </Badge>
                    )}
                    {cls.status === 'removed' && (
                      <Badge
                        variant="outline"
                        className="border-neutral-300 text-neutral-500 bg-neutral-100 dark:bg-neutral-800 text-xs font-medium"
                      >
                        Removed
                      </Badge>
                    )}
                  </div>

                  <CardDescription className="text-xs pt-1 flex items-center gap-1.5 text-neutral-500">
                    <UserCheck className="w-3.5 h-3.5" />
                    Instructor: <span className="font-medium text-neutral-700 dark:text-neutral-300">{cls.teacher_name}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">
                  {/* Status-specific descriptions */}
                  {cls.status === 'pending' && (
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 flex items-center gap-2 text-xs">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Waiting for teacher approval</span>
                    </div>
                  )}

                  {cls.status === 'rejected' && (
                    <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-900/40 text-red-900 dark:text-red-200 flex items-center gap-2 text-xs">
                      <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                      <span>Request was declined by teacher</span>
                    </div>
                  )}

                  {cls.status === 'removed' && (
                    <div className="p-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 flex items-center gap-2 text-xs">
                      <AlertCircle className="w-4 h-4 text-neutral-500 shrink-0" />
                      <span>Membership was removed</span>
                    </div>
                  )}

                  {cls.status === 'approved' && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200 flex items-center justify-between text-xs">
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
                          className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center"
                        >
                          View <ArrowRight className="w-3 h-3 ml-0.5" />
                        </Link>
                      )}
                    </div>
                  )}

                  <div className="text-[11px] text-neutral-400 pt-1 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    <span>Requested on {new Date(cls.requested_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t border-neutral-100 dark:border-neutral-800/60">
                  {cls.status === 'approved' ? (
                    <Link
                      href="/exams"
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        'w-full text-xs text-neutral-700 dark:text-neutral-200'
                      )}
                    >
                      <BookOpen className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                      View Exams
                    </Link>
                  ) : cls.status === 'removed' ? (
                    <Link
                      href="/join"
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        'w-full text-xs text-neutral-700 dark:text-neutral-200'
                      )}
                    >
                      <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                      Re-request with Code
                    </Link>
                  ) : (
                    <div className="w-full text-center py-1 text-xs text-neutral-400 italic">
                      {cls.status === 'pending' ? 'Pending instructor review' : 'Access closed'}
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
