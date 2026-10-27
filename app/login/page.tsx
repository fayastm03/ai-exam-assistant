'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { GraduationCap, AlertCircle, Loader2, CheckCircle2, Mail } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [emailUnconfirmedManual, setEmailUnconfirmedManual] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Derive initial error & success message from query parameters
  const errorParam = searchParams.get('error');
  const successParam = searchParams.get('success');

  const isEmailUnconfirmed = emailUnconfirmedManual || errorParam === 'email_not_confirmed';

  const urlError =
    errorParam === 'auth_required'
      ? 'Please sign in to access this page.'
      : errorParam === 'session_expired'
      ? 'Your session has expired. Please sign in again.'
      : errorParam === 'teacher_required'
      ? 'Access denied: You must be a teacher to view the teacher dashboard.'
      : errorParam === 'student_required'
      ? 'Access denied: You must be a student to view the student portal.'
      : errorParam === 'email_not_confirmed'
      ? 'Your email address is not confirmed. Please check your inbox or resend the verification email below.'
      : null;

  const urlSuccess =
    successParam === 'registered'
      ? 'Account created! Please check your email to confirm your account before signing in.'
      : successParam === 'reset_success'
      ? 'Your password has been reset successfully. Please sign in with your new password.'
      : null;

  const activeError = errorMsg || urlError;
  const activeSuccess = successMsg || urlSuccess;

  // Handle countdown for resend button
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setEmailUnconfirmedManual(false);
    setLoading(true);

    const cleanEmail = email.trim();

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const isUnconfirmed =
          error.message.toLowerCase().includes('email not confirmed') ||
          error.message.toLowerCase().includes('not confirmed') ||
          error.status === 400 && error.message.toLowerCase().includes('email');

        if (isUnconfirmed) {
          setEmailUnconfirmedManual(true);
          setErrorMsg(
            'Your email address is not confirmed. Please check your inbox or resend the confirmation email below.'
          );
        } else {
          setErrorMsg(error.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        // Double check confirmation
        if (!data.user.email_confirmed_at) {
          setEmailUnconfirmedManual(true);
          setErrorMsg(
            'Your email address is not confirmed. Please check your inbox or click Resend below.'
          );
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        // Fetch user profile to determine role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        const userRole = profile?.role ?? data.user.user_metadata?.role ?? 'student';
        const next = searchParams.get('next');

        if (next && next.startsWith('/') && !next.startsWith('//')) {
          router.push(next);
        } else if (userRole === 'teacher') {
          router.push('/teacher/exams');
        } else {
          router.push('/exams');
        }
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to sign in. Please try again.');
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email address to resend confirmation.');
      return;
    }

    setResending(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg(`Confirmation email sent to ${cleanEmail}. Please check your inbox.`);
        setResendCooldown(60);
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to resend confirmation email.'
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-md px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white mb-3 shadow-md shadow-blue-500/20">
          <GraduationCap className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          AI Exam Assistant
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Sign in to your account
        </p>
      </div>

      <Card className="shadow-lg border-neutral-200/80 dark:border-neutral-800">
        <CardHeader className="pb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Sign In
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Enter your credentials to continue
          </p>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {activeError && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <div className="ml-2">
                <AlertTitle className="text-xs font-semibold">Error</AlertTitle>
                <AlertDescription className="text-xs">{activeError}</AlertDescription>
              </div>
            </Alert>
          )}

          {activeSuccess && (
            <Alert className="py-2.5 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="ml-2">
                <AlertDescription className="text-xs">{activeSuccess}</AlertDescription>
              </div>
            </Alert>
          )}

          {isEmailUnconfirmed && (
            <div className="p-3.5 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 space-y-2">
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  <p className="font-semibold">Email confirmation required</p>
                  <p className="mt-0.5">
                    Didn&apos;t receive the email or did it expire? Click below to send a fresh confirmation link.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResendConfirmation}
                disabled={resending || resendCooldown > 0 || !email.trim()}
                className="w-full text-xs h-8 border-amber-400 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/50"
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Sending email...
                  </>
                ) : resendCooldown > 0 ? (
                  `Resend in ${resendCooldown}s`
                ) : (
                  'Resend Confirmation Email'
                )}
              </Button>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="signin-email">Email Address</Label>
              <Input
                id="signin-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="signin-password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="signin-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="pt-0 pb-4 text-center justify-center flex-col gap-2">
          <p className="text-xs text-neutral-500">
            Don&apos;t have an account yet?{' '}
            <Link
              href={searchParams.get('next') ? `/signup?next=${encodeURIComponent(searchParams.get('next')!)}` : '/signup'}
              className="text-blue-600 font-semibold hover:underline dark:text-blue-400"
            >
              Sign up as a student
            </Link>
          </p>
          <p className="text-[11px] text-neutral-400">
            (Teacher accounts are provisioned by system administrator)
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-neutral-50 dark:bg-neutral-950">
      <Suspense fallback={<div className="text-sm text-neutral-500">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
