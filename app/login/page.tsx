'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppMessage } from '@/components/ui/app-message';
import { Loader2, Mail, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mapAuthError, mapUrlAuthParam, type UserMessage, MESSAGES } from '@/lib/messages';
import { BrandLogo } from '@/components/auth/brand-logo';
import { LoginIllustration } from '@/components/auth/login-illustration';

const SHOWCASE_SLIDES = [
  {
    title: 'Seamless Exam Experience',
    description: 'Distraction-free online testing with automatic saving, synchronized countdown timers, and instant submission.',
  },
  {
    title: 'Automated AI Evaluation',
    description: 'Instant scoring with detailed question breakdowns, performance analysis, and tailored revision tips.',
  },
  {
    title: 'Smart Class Management',
    description: 'Publish tests in seconds, organize students with simple join codes, and monitor live exam progress.',
  },
];

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

  // Showcase slide state
  const [activeSlide, setActiveSlide] = useState(0);

  // Auto-advance showcase slides every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % SHOWCASE_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
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
      const res = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend confirmation email.');
      }

      if (data.status === 'already_confirmed') {
        setEmailUnconfirmedManual(false);
        setPageMessage({
          type: 'success',
          message: 'Your email is already confirmed! Please enter your password to sign in.',
        });
        return;
      }

      setPageMessage({
        type: 'success',
        message: data.message || `Confirmation email sent to ${cleanEmail}. Check your inbox.`,
      });
      setResendCooldown(60);
    } catch (err: unknown) {
      setPageMessage(mapAuthError(err));
    } finally {
      setResending(false);
    }
  };

  const currentSlide = SHOWCASE_SLIDES[activeSlide];

  return (
    <div className="w-full max-w-4xl mx-auto my-6 sm:my-10 p-2 sm:p-4">
      <div className="w-full bg-card rounded-2xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">
        {/* Left Column: Form */}
        <div className="p-6 sm:p-10 lg:p-12 flex flex-col justify-between">
          <div className="space-y-6">
            {/* Top Logo */}
            <div className="flex items-center">
              <BrandLogo />
            </div>

            {/* Header Titles */}
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Welcome Back
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Sign in to access your exams, classes, and results.
              </p>
            </div>

            {/* Notification / Alert Message */}
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

            {/* Form */}
            <form onSubmit={handleSignIn} className="space-y-4" noValidate>
              {/* Email Address */}
              <div className="space-y-1.5">
                <Label htmlFor="signin-email" className="text-xs sm:text-sm font-medium text-foreground">
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
                    'h-11 text-sm rounded-lg bg-background border-border/80 focus-visible:ring-primary',
                    fieldErrors.email && 'border-destructive focus-visible:ring-destructive'
                  )}
                  autoComplete="email"
                  disabled={loading}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="signin-password" className="text-xs sm:text-sm font-medium text-foreground">
                  Password
                </Label>
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
                      'h-11 text-sm rounded-lg bg-background border-border/80 pr-10 focus-visible:ring-primary',
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors rounded-md focus-visible:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>
                )}
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end pt-0.5">
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  Forgot Password?
                </Link>
              </div>

              {/* Login Submit Button */}
              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    Sign In <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Sign-up Footer */}
          <div className="mt-8 pt-4 border-t border-border/50 text-center space-y-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Need a student account?{' '}
                <Link
                  href={
                    searchParams.get('next')
                      ? `/signup?next=${encodeURIComponent(searchParams.get('next')!)}`
                      : '/signup'
                  }
                  className="text-primary font-semibold hover:underline"
                >
                  Sign Up
                </Link>
              </p>
              <p className="text-[11px] text-muted-foreground/80">
                Teacher accounts are provisioned by your school administrator.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Hero Feature Showcase */}
        <div className="hidden lg:flex p-6 lg:p-8 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 items-center justify-center relative overflow-hidden">
          {/* Subtle decorative glow discs */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

          {/* Translucent Card Container */}
          <div className="relative w-full max-w-sm h-full min-h-[460px] rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-6 sm:p-8 flex flex-col justify-between overflow-hidden shadow-2xl">
            {/* Top & Center: Illustration */}
            <div className="flex-1 flex items-center justify-center">
              <LoginIllustration activeSlide={activeSlide} />
            </div>

            {/* Bottom Copy & Slider Dots */}
            <div className="space-y-4 pt-4 select-none">
              <div className="space-y-1.5 transition-all duration-300">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                  {currentSlide.title}
                </h2>
                <p className="text-xs sm:text-sm text-white/80 leading-relaxed min-h-[40px]">
                  {currentSlide.description}
                </p>
              </div>

              {/* Interactive Pagination Dots */}
              <div className="flex items-center gap-2 pt-1">
                {SHOWCASE_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveSlide(i)}
                    aria-label={`View slide ${i + 1}`}
                    className={cn(
                      'h-2 rounded-full transition-all cursor-pointer',
                      activeSlide === i
                        ? 'w-8 bg-white shadow-sm'
                        : 'w-2 bg-white/40 hover:bg-white/60'
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-3 sm:p-6 bg-slate-50/60 dark:bg-background">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
