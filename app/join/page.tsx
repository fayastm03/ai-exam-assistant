'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  ArrowRight,
  BookOpen,
} from 'lucide-react';

type JoinResultType =
  | 'new_pending'
  | 'already_pending'
  | 'already_member'
  | 'declined'
  | 'invalid_code'
  | 'rate_limited'
  | null;

interface JoinResponseData {
  status?: 'pending' | 'approved' | 'rejected' | 'removed';
  message?: string;
  class?: {
    id: string;
    name: string;
  };
}

function getInitialCode(params: ReturnType<typeof useSearchParams>): string {
  const urlCode = params.get('code');
  if (urlCode) {
    const clean = urlCode.trim().toUpperCase();
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pending_join_code', clean);
      }
    } catch {
      // Ignore storage access errors
    }
    return clean;
  }
  try {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('pending_join_code');
      if (stored) return stored.trim().toUpperCase();
    }
  } catch {
    // Ignore storage access errors
  }
  return '';
}

function JoinClassForm() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(() => getInitialCode(searchParams));
  const [submitting, setSubmitting] = useState(false);
  const [resultType, setResultType] = useState<JoinResultType>(null);
  const [resultClass, setResultClass] = useState<{ id: string; name: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync any newly provided code in URL to sessionStorage
  useEffect(() => {
    const urlCode = searchParams.get('code');
    if (urlCode) {
      const normalized = urlCode.trim().toUpperCase();
      try {
        sessionStorage.setItem('pending_join_code', normalized);
      } catch {
        // Ignore storage access errors
      }
    }
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow alphanumeric characters, uppercase, max length 6
    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(clean);
    if (resultType) {
      setResultType(null);
      setResultClass(null);
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      setErrorMessage('Please enter a 6-character class code.');
      return;
    }

    if (normalizedCode.length !== 6) {
      setErrorMessage('Class codes are exactly 6 characters long.');
      return;
    }

    setSubmitting(true);
    setResultType(null);
    setResultClass(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/student/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode }),
      });

      const body = await res.json();

      if (res.status === 429) {
        setResultType('rate_limited');
        return;
      }

      if (!res.ok) {
        // Generic invalid or disabled code
        setResultType('invalid_code');
        return;
      }

      const data = body as JoinResponseData;
      setResultClass(data.class || null);

      // Clear pending storage code on successful submit
      try {
        sessionStorage.removeItem('pending_join_code');
      } catch {
        // Ignore
      }

      if (data.status === 'approved') {
        setResultType('already_member');
      } else if (data.status === 'rejected') {
        setResultType('declined');
      } else if (data.status === 'pending') {
        // Check message to distinguish newly submitted vs already pending
        const msg = (data.message || '').toLowerCase();
        if (msg.includes('already pending')) {
          setResultType('already_pending');
        } else {
          setResultType('new_pending');
        }
      } else {
        setResultType('new_pending');
      }
    } catch {
      setResultType('invalid_code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setCode('');
    setResultType(null);
    setResultClass(null);
    setErrorMessage(null);
    try {
      sessionStorage.removeItem('pending_join_code');
    } catch {
      // Ignore
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-4 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          Join a Class
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Enter the 6-character code provided by your instructor to request access.
        </p>
      </div>

      {/* Result feedback cards */}
      {resultType === 'new_pending' && (
        <Card className="border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-semibold text-sm text-amber-950 dark:text-amber-100">
                  Request sent, waiting for your teacher to approve
                </h3>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                  {resultClass?.name ? (
                    <>
                      Your membership request for{' '}
                      <strong>{resultClass.name}</strong> has been submitted. You will be able to take exams as soon as your teacher approves it.
                    </>
                  ) : (
                    'Your membership request has been submitted. You will be able to take exams as soon as your teacher approves it.'
                  )}
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Link
                href="/classes"
                className={cn(
                  buttonVariants({ variant: 'default', size: 'sm' }),
                  'w-full sm:w-auto text-xs bg-amber-600 hover:bg-amber-700 text-white'
                )}
              >
                <Users className="w-3.5 h-3.5 mr-1.5" />
                View My Classes
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="w-full sm:w-auto text-xs"
              >
                Join Another Class
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {resultType === 'already_pending' && (
        <Card className="border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-semibold text-sm text-amber-950 dark:text-amber-100">
                  Your request is pending
                </h3>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                  {resultClass?.name ? (
                    <>
                      You already have a pending request for{' '}
                      <strong>{resultClass.name}</strong>. Waiting for your teacher to review and approve your request.
                    </>
                  ) : (
                    'You already have a pending request for this class. Waiting for teacher approval.'
                  )}
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Link
                href="/classes"
                className={cn(
                  buttonVariants({ variant: 'default', size: 'sm' }),
                  'w-full sm:w-auto text-xs bg-amber-600 hover:bg-amber-700 text-white'
                )}
              >
                <Users className="w-3.5 h-3.5 mr-1.5" />
                View My Classes
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="w-full sm:w-auto text-xs"
              >
                Join Another Class
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {resultType === 'already_member' && (
        <Card className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-semibold text-sm text-emerald-950 dark:text-emerald-100">
                  You are already a member
                </h3>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-300/80 leading-relaxed">
                  {resultClass?.name ? (
                    <>
                      You are an approved member of{' '}
                      <strong>{resultClass.name}</strong>. You have immediate access to any exams published for this class.
                    </>
                  ) : (
                    'You are already an approved member of this class.'
                  )}
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Link
                href="/exams"
                className={cn(
                  buttonVariants({ variant: 'default', size: 'sm' }),
                  'w-full sm:w-auto text-xs bg-emerald-600 hover:bg-emerald-700 text-white'
                )}
              >
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                Browse Exams
              </Link>
              <Link
                href="/classes"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'w-full sm:w-auto text-xs'
                )}
              >
                View My Classes
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {resultType === 'declined' && (
        <Card className="border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-semibold text-sm text-red-950 dark:text-red-100">
                  Your request was declined
                </h3>
                <p className="text-xs text-red-800/90 dark:text-red-300/80 leading-relaxed">
                  Your request to join this class was declined by the instructor. Please contact your teacher if you believe this is in error.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Link
                href="/classes"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'w-full sm:w-auto text-xs'
                )}
              >
                View My Classes
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="w-full sm:w-auto text-xs"
              >
                Try Another Code
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {resultType === 'rate_limited' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">Too Many Attempts</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Too many join attempts. Please wait a few minutes before trying again.
          </AlertDescription>
        </Alert>
      )}

      {resultType === 'invalid_code' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">Invalid Code</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Invalid or disabled code. Please verify the 6-character code with your teacher.
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Main Join Input Card */}
      <Card className="border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <form onSubmit={handleSubmit}>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base font-semibold">Class Code</CardTitle>
            <CardDescription className="text-xs">
              Codes are 6 alphanumeric characters and are not case-sensitive.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="join-code" className="text-xs font-medium sr-only">
                Class Join Code
              </Label>
              <div className="relative">
                <Input
                  id="join-code"
                  type="text"
                  value={code}
                  onChange={handleInputChange}
                  placeholder="e.g. 29XAB8"
                  maxLength={6}
                  disabled={submitting}
                  autoFocus
                  className="font-mono text-center text-2xl tracking-[0.25em] uppercase font-bold h-14 bg-neutral-50/50 dark:bg-neutral-900/50 border-neutral-300 dark:border-neutral-700"
                />
              </div>
              <p className="text-[11px] text-neutral-400 text-center">
                Never share class codes with individuals outside your school or institution.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-900">
            <Button
              type="submit"
              disabled={submitting || code.trim().length !== 6}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting Request...
                </>
              ) : (
                <>
                  Join Class
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Quick Navigation Footer */}
      <div className="text-center">
        <Link
          href="/classes"
          className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 inline-flex items-center gap-1.5"
        >
          <Users className="w-3.5 h-3.5" />
          View all your classes and membership status
        </Link>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          <p className="text-xs text-neutral-400">Loading join portal...</p>
        </div>
      }
    >
      <JoinClassForm />
    </Suspense>
  );
}
