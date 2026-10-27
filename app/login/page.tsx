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
import { GraduationCap, Loader2, Mail, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mapAuthError, mapUrlAuthParam, type UserMessage, MESSAGES } from '@/lib/messages';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    if (successParam === 'confirmed') {
      return { type: 'success', message: MESSAGES.success.emailConfirmed };
    }
    return null;
  });

  const errorParam = searchParams.get('error');
  const isEmailUnconfirmed = emailUnconfirmedManual || errorParam === 'email_not_confirmed';

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
      errors.email = 'Enter your email address.';
    } else if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      errors.email = 'Enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Enter your password.';
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
        if (!data.user.email_confirmed_at) {
          setEmailUnconfirmedManual(true);
          setPageMessage(MESSAGES.auth.emailNotConfirmed);
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        const userRole = profile?.role ?? data.user.user_metadata?.role ?? 'student';
        const next = searchParams.get('next');

        const targetUrl =
          next && next.startsWith('/') && !next.startsWith('//')
            ? next
            : userRole === 'teacher'
            ? '/teacher/exams'
            : '/exams';

        // Hard browser navigation ensures session cookies are cleanly sent to server components
        // and prevents soft-routing race conditions that leave the button stuck on "Signing In..."
        window.location.href = targetUrl;
      } else {
        setLoading(false);
      }
    } catch (err: unknown) {
      setPageMessage(mapAuthError(err));
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setFieldErrors({ email: 'Enter your email address to resend confirmation.' });
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
          message: `Confirmation email sent to ${cleanEmail}. Check your inbox.`,
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
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-left space-y-1">
        <div className="flex items-center gap-2 mb-2 text-primary font-bold text-lg">
          <GraduationCap className="w-6 h-6" />
          <span>AI Exam Assistant</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign In</h1>
        <p className="text-sm text-muted-foreground">Enter your credentials to continue.</p>
      </div>

      <Card className="rounded-lg border border-border shadow-sm bg-card">
        <CardContent className="p-6 space-y-4">
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
            <div className="p-3.5 rounded-lg border border-warning/40 bg-warning/10 text-foreground space-y-2.5">
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold">Email confirmation required</p>
                  <p className="text-muted-foreground">
                    Check your inbox for your confirmation link, or request a new one below.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResendConfirmation}
                disabled={resending || resendCooldown > 0 || !email.trim()}
                className="w-full h-9 text-xs rounded-lg border-border"
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
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
              <Label htmlFor="signin-email" className="text-sm font-medium">
                Email Address
              </Label>
              <Input
                ref={emailInputRef}
                id="signin-email"
                type="email"
                placeholder="you@school.edu"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                aria-invalid={!!fieldErrors.email}
                className={cn(
                  'h-10 text-base rounded-lg',
                  fieldErrors.email && 'border-destructive focus-visible:ring-destructive'
                )}
                autoComplete="email"
                disabled={loading}
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="signin-password" className="text-sm font-medium">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  ref={passwordInputRef}
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  aria-invalid={!!fieldErrors.password}
                  className={cn(
                    'h-10 text-base rounded-lg pr-10',
                    fieldErrors.password && 'border-destructive focus-visible:ring-destructive'
                  )}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10 text-base font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
              disabled={loading}
            >
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

        <CardFooter className="px-6 py-4 border-t border-border bg-muted/30 rounded-b-lg flex flex-col gap-1.5 text-center text-xs text-muted-foreground">
          <p>
            Need a student account?{' '}
            <Link
              href={
                searchParams.get('next')
                  ? `/signup?next=${encodeURIComponent(searchParams.get('next')!)}`
                  : '/signup'
              }
              className="text-primary font-semibold hover:underline"
            >
              Sign up
            </Link>
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            Teacher accounts are set up by your school administrator.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
