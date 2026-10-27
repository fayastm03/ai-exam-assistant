'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppMessage } from '@/components/ui/app-message';
import { cn } from '@/lib/utils';
import { MESSAGES } from '@/lib/messages';
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  ArrowRight,
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
  const codeInputRef = React.useRef<HTMLInputElement>(null);
  const [code, setCode] = useState(() => getInitialCode(searchParams));
  const [submitting, setSubmitting] = useState(false);
  const [resultType, setResultType] = useState<JoinResultType>(null);
  const [resultClass, setResultClass] = useState<{ id: string; name: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const urlCode = searchParams.get('code');
    if (urlCode) {
      const normalized = urlCode.trim().toUpperCase();
      try {
        sessionStorage.setItem('pending_join_code', normalized);
      } catch {
        // Ignore
      }
    }
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setErrorMessage('Enter your 6-character class code.');
      codeInputRef.current?.focus();
      return;
    }

    if (normalizedCode.length !== 6) {
      setErrorMessage('Class codes are exactly 6 characters.');
      codeInputRef.current?.focus();
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
        setResultType('invalid_code');
        return;
      }

      const data = body as JoinResponseData;
      setResultClass(data.class || null);

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
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-left space-y-1">
        <div className="flex items-center gap-2 mb-2 text-primary font-bold text-lg">
          <Users className="w-5 h-5" />
          <span>Classes</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Join a Class</h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-character code given by your teacher to request access.
        </p>
      </div>

      {resultType === 'new_pending' && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <Clock className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-foreground">
                Request sent, waiting for teacher approval
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {resultClass?.name ? (
                  <>
                    Your request to join <strong>{resultClass.name}</strong> was submitted. You will see assigned exams once approved.
                  </>
                ) : (
                  'Your request was submitted. You will see assigned exams once approved.'
                )}
              </p>
            </div>
          </div>
          <div className="pt-1 flex flex-col sm:flex-row gap-2">
            <Link
              href="/classes"
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                'w-full sm:w-auto h-8 text-xs rounded-lg'
              )}
            >
              View My Classes
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="w-full sm:w-auto h-8 text-xs rounded-lg"
            >
              Join Another
            </Button>
          </div>
        </div>
      )}

      {resultType === 'already_pending' && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <Clock className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-foreground">Your request is pending</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {resultClass?.name ? (
                  <>
                    You already have a pending request for <strong>{resultClass.name}</strong>.
                  </>
                ) : (
                  'You already have a pending request for this class.'
                )}
              </p>
            </div>
          </div>
          <div className="pt-1 flex flex-col sm:flex-row gap-2">
            <Link
              href="/classes"
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                'w-full sm:w-auto h-8 text-xs rounded-lg'
              )}
            >
              View My Classes
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="w-full sm:w-auto h-8 text-xs rounded-lg"
            >
              Try Another Code
            </Button>
          </div>
        </div>
      )}

      {resultType === 'already_member' && (
        <div className="rounded-lg border border-success/40 bg-success/10 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-foreground">Already a member</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {resultClass?.name ? (
                  <>
                    You are already enrolled in <strong>{resultClass.name}</strong>.
                  </>
                ) : (
                  'You are already enrolled in this class.'
                )}
              </p>
            </div>
          </div>
          <div className="pt-1">
            <Link
              href="/exams"
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                'w-full sm:w-auto h-8 text-xs rounded-lg'
              )}
            >
              View Available Exams
            </Link>
          </div>
        </div>
      )}

      {resultType === 'declined' && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-foreground">Request was declined</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your request to join this class was declined. Speak with your teacher if this was unexpected.
              </p>
            </div>
          </div>
          <div className="pt-1 flex flex-col sm:flex-row gap-2">
            <Link
              href="/classes"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'w-full sm:w-auto h-8 text-xs rounded-lg'
              )}
            >
              View My Classes
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="w-full sm:w-auto h-8 text-xs rounded-lg"
            >
              Try Another Code
            </Button>
          </div>
        </div>
      )}

      {resultType === 'rate_limited' && (
        <AppMessage message={MESSAGES.classes.rateLimited} />
      )}

      {resultType === 'invalid_code' && (
        <AppMessage message={MESSAGES.classes.invalidCode} />
      )}

      {errorMessage && (
        <AppMessage message={errorMessage} type="error" />
      )}

      <Card className="rounded-lg border border-border shadow-sm bg-card">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="join-code" className="text-sm font-medium">
                6-Character Code
              </Label>
              <Input
                ref={codeInputRef}
                id="join-code"
                type="text"
                value={code}
                onChange={handleInputChange}
                placeholder="ABC123"
                maxLength={6}
                disabled={submitting}
                autoFocus
                aria-invalid={!!errorMessage || resultType === 'invalid_code'}
                className={cn(
                  'font-mono text-center text-xl tracking-widest uppercase font-semibold h-11 rounded-lg border-input',
                  (errorMessage || resultType === 'invalid_code') &&
                    'border-destructive focus-visible:ring-destructive'
                )}
              />
              <p className="text-xs text-muted-foreground">
                Class codes are not case-sensitive.
              </p>
            </div>

            <Button
              type="submit"
              disabled={submitting || code.trim().length !== 6}
              className="w-full h-10 text-base font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer mt-2"
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
          </CardContent>

          <CardFooter className="px-6 py-4 border-t border-border bg-muted/30 rounded-b-lg text-center justify-center">
            <Link
              href="/classes"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              View your existing classes and enrollment status
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function JoinPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background">
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center p-8 space-y-2 text-muted-foreground text-sm">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p>Loading class portal...</p>
          </div>
        }
      >
        <JoinClassForm />
      </Suspense>
    </main>
  );
}
