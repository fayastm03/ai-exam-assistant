'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppMessage } from '@/components/ui/app-message';
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const next = searchParams.get('next');

  const [resending, setResending] = useState(false);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Check if the email is already confirmed in the database on load
  useEffect(() => {
    if (!email) return;

    let ignore = false;
    async function checkStatus() {
      try {
        const res = await fetch(
          `/api/auth/resend-confirmation?email=${encodeURIComponent(email)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.confirmed) {
            setAlreadyConfirmed(true);
            setSuccessMsg('Your email is already confirmed. You can sign in now.');
          }
        }
      } catch {
        // Continue silently if check fails
      }
    }

    checkStatus();
    return () => {
      ignore = true;
    };
  }, [email]);

  const handleResend = async () => {
    if (!email) {
      setErrorMsg('No email address provided. Please return to sign up.');
      return;
    }

    setResending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, next }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend confirmation email.');
      }

      if (data.status === 'already_confirmed') {
        setAlreadyConfirmed(true);
        setSuccessMsg(data.message || 'Your email is already confirmed. You can sign in directly.');
        return;
      }

      setSuccessMsg(data.message || `Confirmation email resent to ${email}. Check your inbox.`);
      setCooldown(30);

      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to resend confirmation email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-left space-y-1">
        <div className="flex items-center gap-2 mb-2 text-primary font-bold text-lg">
          <Mail className="w-5 h-5" />
          <span>Confirm Email</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Check Your Inbox</h1>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <strong className="text-foreground">{email || 'your email'}</strong>. Click the link to activate your account.
        </p>
      </div>

      <Card className="rounded-lg border border-border shadow-sm bg-card">
        <CardContent className="p-6 space-y-4">
          {successMsg && <AppMessage message={successMsg} type="success" />}
          {errorMsg && <AppMessage message={errorMsg} type="error" />}

          {alreadyConfirmed ? (
            <div className="p-3.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Account Already Verified</span>
              </div>
              <p className="text-muted-foreground">
                Your email address has already been confirmed. You do not need another email link.
              </p>
              <Link
                href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
                className="inline-flex w-full items-center justify-center h-9 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-2"
              >
                Sign In Now
              </Link>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The link is valid for 24 hours. If you do not see it within a couple of minutes, check your spam folder.
              </p>

              <Button
                type="button"
                variant="outline"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
                className="w-full h-10 text-sm font-medium rounded-lg"
              >
                {resending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking & Resending...
                  </>
                ) : cooldown > 0 ? (
                  `Resend in ${cooldown}s`
                ) : (
                  'Resend Confirmation Email'
                )}
              </Button>
            </>
          )}
        </CardContent>

        <CardFooter className="px-6 py-4 border-t border-border bg-muted/30 rounded-b-lg text-center justify-center">
          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground font-medium inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
        <CheckEmailContent />
      </Suspense>
    </main>
  );
}
