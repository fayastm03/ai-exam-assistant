'use client';

import React, { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppMessage } from '@/components/ui/app-message';
import { GraduationCap, Loader2, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mapAuthError, mapUrlAuthParam, type UserMessage, MESSAGES } from '@/lib/messages';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [emailUnconfirmedManual, setEmailUnconfirmedManual] = useState(false);

  const [pageMessage, setPageMessage] = useState<UserMessage | null>(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      return mapUrlAuthParam(errorParam);
    }
    const successParam = searchParams.get('success');
    if (successParam === 'registered') {
      return { type: 'success', message: MESSAGES.success.registered };
    }
    if (successParam === 'reset_success') {
      return { type: 'success', message: MESSAGES.success.passwordUpdated };
    }
    return null;
  });

  const errorParam = searchParams.get('error');
  const isEmailUnconfirmed = emailUnconfirmedManual || errorParam === 'email_not_confirmed';

  // Handle countdown for resend button
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const validateFields = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      errors.email = 'Please enter your email address.';
    } else if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Please enter your password.';
    }

    setFieldErrors(errors);

    if (errors.email) {
      emailInputRef.current?.focus();
      return false;
    }
    if (errors.password) {
      passwordInputRef.current?.focus();
      return false;
    }

    return true;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageMessage(null);
    setEmailUnconfirmedManual(false);

    if (!validateFields()) {
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim();

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const mapped = mapAuthError(error);
        if (mapped.actionKey === 'resend_confirmation') {
          setEmailUnconfirmedManual(true);
        }
        setPageMessage(mapped);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Double check confirmation
        if (!data.user.email_confirmed_at) {
          setEmailUnconfirmedManual(true);
          setPageMessage(MESSAGES.auth.emailNotConfirmed);
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
      setPageMessage(mapAuthError(err));
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setFieldErrors({ email: 'Please enter your email address to resend confirmation.' });
      emailInputRef.current?.focus();
      return;
    }

    setResending(true);
    setPageMessage(null);

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
        setPageMessage(mapAuthError(error));
      } else {
        setPageMessage({
          type: 'success',
          message: `Confirmation email sent to ${cleanEmail}. Please check your inbox.`,
        });
        setResendCooldown(60);
      }
    } catch (err: unknown) {
      setPageMessage(mapAuthError(err));
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
          {pageMessage && (
            <AppMessage
              message={pageMessage}
              actionLabel={pageMessage.actionLabel}
              onAction={
                pageMessage.actionKey === 'resend_confirmation'
                  ? handleResendConfirmation
                  : undefined
              }
            />
          )}

          {isEmailUnconfirmed && !pageMessage?.actionKey && (
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

          <form onSubmit={handleSignIn} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="signin-email">Email Address</Label>
              <Input
                ref={emailInputRef}
                id="signin-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                aria-invalid={!!fieldErrors.email}
                className={cn(fieldErrors.email && 'border-red-500 focus-visible:ring-red-400')}
                autoComplete="email"
                disabled={loading}
              />
              {fieldErrors.email && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.email}
                </p>
              )}
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
                ref={passwordInputRef}
                id="signin-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                aria-invalid={!!fieldErrors.password}
                className={cn(fieldErrors.password && 'border-red-500 focus-visible:ring-red-400')}
                autoComplete="current-password"
                disabled={loading}
              />
              {fieldErrors.password && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.password}
                </p>
              )}
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
              href={
                searchParams.get('next')
                  ? `/signup?next=${encodeURIComponent(searchParams.get('next')!)}`
                  : '/signup'
              }
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
