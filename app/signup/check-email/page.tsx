'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [resending, setResending] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const handleResend = async () => {
    if (!email) {
      setErrorMsg('No email address provided. Please go back to the signup page.');
      return;
    }

    setResending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const supabase = createClient();
      const origin = window.location.origin;

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setSuccessMsg(`Verification email has been resent to ${email}!`);
      setCooldown(30);

      // Decrement cooldown timer
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
      setErrorMsg(err instanceof Error ? err.message : 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg border-neutral-200/80 dark:border-neutral-800 text-center">
      <CardHeader className="space-y-3 pb-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center border border-blue-200 dark:border-blue-900 shadow-sm">
          <Mail className="w-7 h-7" />
        </div>
        <div>
          <CardTitle className="text-xl font-bold tracking-tight">
            Check Your Email
          </CardTitle>
          <CardDescription className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            We have sent a confirmation link to{' '}
            <strong className="text-neutral-900 dark:text-neutral-100">{email || 'your email address'}</strong>.
            Please click the link in that email to confirm your account.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {successMsg && (
          <Alert className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 py-2.5 text-left">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-xs font-medium">{successMsg}</AlertDescription>
          </Alert>
        )}

        {errorMsg && (
          <Alert variant="destructive" className="py-2.5 text-left">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
          </Alert>
        )}

        <div className="p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg border border-neutral-200/70 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 space-y-1 text-left">
          <p className="font-semibold text-neutral-800 dark:text-neutral-200">
            Didn&apos;t receive the email?
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-neutral-500">
            <li>Check your spam or junk folder.</li>
            <li>Ensure you typed the correct email address.</li>
            <li>Wait a minute and request a new link below.</li>
          </ul>
        </div>

        <Button
          onClick={handleResend}
          disabled={resending || cooldown > 0 || !email}
          variant="outline"
          className="w-full h-9 text-xs font-semibold"
        >
          {resending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              Resending Verification Email...
            </>
          ) : cooldown > 0 ? (
            `Resend in ${cooldown}s`
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5 mr-2 text-neutral-500" />
              Resend verification email
            </>
          )}
        </Button>
      </CardContent>

      <CardFooter className="flex justify-center border-t border-neutral-100 dark:border-neutral-900 pt-3">
        <Link
          href="/login"
          className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4 py-8">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <p className="text-xs text-neutral-400">Loading...</p>
        </div>
      }>
        <CheckEmailContent />
      </Suspense>
    </div>
  );
}
