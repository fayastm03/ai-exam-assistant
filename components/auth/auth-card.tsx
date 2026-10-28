'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppMessage } from '@/components/ui/app-message';
import { Loader2, Mail, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mapAuthError, mapUrlAuthParam, type UserMessage, MESSAGES } from '@/lib/messages';
import { BrandLogo } from '@/components/auth/brand-logo';
import { LoginIllustration } from '@/components/auth/login-illustration';

export type AuthMode = 'signin' | 'signup' | 'forgot';

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

export function AuthCard({ initialMode = 'signin' }: { initialMode?: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode state: 'signin' | 'signup' | 'forgot'
  const paramMode = searchParams.get('mode') as AuthMode | null;
  const [mode, setMode] = useState<AuthMode>(
    paramMode && ['signin', 'signup', 'forgot'].includes(paramMode) ? paramMode : initialMode
  );

  // Field states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Focus refs
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Error & loading states
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  // Resend confirmation state (Sign in)
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [emailUnconfirmedManual, setEmailUnconfirmedManual] = useState(false);

  // Forgot password cooldown state
  const [forgotCooldown, setForgotCooldown] = useState(0);

  // Showcase slide state
  const [activeSlide, setActiveSlide] = useState(0);

  // Auto-advance showcase slides every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % SHOWCASE_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Cooldown timers
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (forgotCooldown <= 0) return;
    const timer = setInterval(() => {
      setForgotCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [forgotCooldown]);

  // Initial page message from searchParams
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

  // Mode switcher with URL synchronization (without page reloads)
  const switchMode = (newMode: AuthMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setFieldErrors({});
    setPageMessage(null);
    setEmailUnconfirmedManual(false);

    if (typeof window !== 'undefined') {
      const nextParam = searchParams.get('next');
      const targetPath =
        newMode === 'signup' ? '/signup' : newMode === 'forgot' ? '/forgot-password' : '/login';
      const newSearch = nextParam ? `?next=${encodeURIComponent(nextParam)}` : '';
      window.history.replaceState(null, '', `${targetPath}${newSearch}`);
    }
  };

  // Sign In submit
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageMessage(null);
    setEmailUnconfirmedManual(false);

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
    if (Object.keys(errors).length > 0) {
      if (errors.email) emailInputRef.current?.focus();
      else if (errors.password) passwordInputRef.current?.focus();
      return;
    }

    setLoading(true);

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
          setPageMessage({
            type: 'error',
            message: 'Your email address has not been confirmed. Please check your inbox.',
            actionLabel: 'Resend confirmation email',
            actionKey: 'resend_confirmation',
          });
          setLoading(false);
          return;
        }

        const next = searchParams.get('next');
        const role = data.user.user_metadata?.role;
        const target = next && next.startsWith('/') ? next : role === 'teacher' ? '/teacher' : '/exams';

        router.push(target);
        router.refresh();
      }
    } catch (err: unknown) {
      setPageMessage(mapAuthError(err));
      setLoading(false);
    }
  };

  // Sign Up submit
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageMessage(null);

    const errors: { name?: string; email?: string; password?: string } = {};
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      errors.name = 'Enter your full name.';
    }

    if (!cleanEmail) {
      errors.email = 'Enter your email address.';
    } else if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      errors.email = 'Enter a valid email address.';
    }

    const hasLetters = /[a-zA-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);

    if (password.length < 8 || !hasLetters || !hasNumbers) {
      errors.password = MESSAGES.auth.passwordWeak.message;
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      if (errors.name) nameInputRef.current?.focus();
      else if (errors.email) emailInputRef.current?.focus();
      else if (errors.password) passwordInputRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const next = searchParams.get('next');

      const callbackUrl = next
        ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
        : `${origin}/auth/callback`;

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanName,
            full_name: cleanName,
          },
          emailRedirectTo: callbackUrl,
        },
      });

      if (error) {
        setPageMessage(mapAuthError(error));
        setLoading(false);
        return;
      }

      if (data.user && (!data.session || !data.user.email_confirmed_at)) {
        const checkEmailUrl = `/signup/check-email?email=${encodeURIComponent(cleanEmail)}${
          next ? `&next=${encodeURIComponent(next)}` : ''
        }`;
        router.push(checkEmailUrl);
        return;
      }

      const target = next && next.startsWith('/') ? next : '/exams';
      router.push(target);
      router.refresh();
    } catch (err: unknown) {
      setPageMessage(mapAuthError(err));
      setLoading(false);
    }
  };

  // Forgot password submit
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setFieldErrors({ email: 'Enter your email address.' });
      emailInputRef.current?.focus();
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFieldErrors({ email: 'Enter a valid email address.' });
      emailInputRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setLoading(true);
    setPageMessage(null);

    try {
      const supabase = createClient();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        setPageMessage(mapAuthError(error));
      } else {
        setPageMessage({
          type: 'success',
          message: MESSAGES.success.passwordResetSent,
        });
        setForgotCooldown(60);
      }
    } catch (err: unknown) {
      setPageMessage(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // Resend confirmation email handler
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
        {/* Left Column: Interactive Auth Form */}
        <div className="p-6 sm:p-10 lg:p-12 flex flex-col justify-between">
          <div className="space-y-6">
            {/* Top Logo & Mode Switcher */}
            <div className="flex items-center justify-between gap-4">
              <BrandLogo />
            </div>

            {/* Seamless Mode Segmented Pill (Sign In / Sign Up) */}
            {mode !== 'forgot' ? (
              <div className="grid grid-cols-2 p-1 bg-secondary/70 rounded-xl border border-border/50 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className={cn(
                    'py-2 rounded-lg transition-all cursor-pointer text-center',
                    mode === 'signin'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={cn(
                    'py-2 rounded-lg transition-all cursor-pointer text-center',
                    mode === 'signup'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Sign Up
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            )}

            {/* Animated Form Container */}
            <div
              key={mode}
              className="space-y-5 animate-in fade-in-50 duration-300 slide-in-from-bottom-2"
            >
              {/* Header Titles */}
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {mode === 'signin'
                    ? 'Welcome Back'
                    : mode === 'signup'
                    ? 'Create Student Account'
                    : 'Forgot Password?'}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {mode === 'signin'
                    ? 'Sign in to access your exams, classes, and results.'
                    : mode === 'signup'
                    ? 'Sign up to take scheduled exams and view feedback.'
                    : 'Enter your registered email address to receive password reset instructions.'}
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

              {/* Sign In Unconfirmed Email Warning */}
              {mode === 'signin' && isEmailUnconfirmed && !pageMessage?.actionKey && (
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
                    className="w-full h-9 text-xs rounded-lg border-border cursor-pointer"
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

              {/* -------------------- SIGN IN FORM -------------------- */}
              {mode === 'signin' && (
                <form onSubmit={handleSignIn} className="space-y-4" noValidate>
                  {/* Email */}
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
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {/* Submit Button */}
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
              )}

              {/* -------------------- SIGN UP FORM -------------------- */}
              {mode === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-4" noValidate>
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name" className="text-xs sm:text-sm font-medium text-foreground">
                      Full Name
                    </Label>
                    <Input
                      ref={nameInputRef}
                      id="signup-name"
                      type="text"
                      placeholder="Alex Johnson"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (fieldErrors.name) {
                          setFieldErrors((prev) => ({ ...prev, name: undefined }));
                        }
                      }}
                      aria-invalid={!!fieldErrors.name}
                      className={cn(
                        'h-11 text-sm rounded-lg bg-background border-border/80 focus-visible:ring-primary',
                        fieldErrors.name && 'border-destructive focus-visible:ring-destructive'
                      )}
                      autoComplete="name"
                      disabled={loading}
                    />
                    {fieldErrors.name && (
                      <p className="text-xs text-destructive mt-1">{fieldErrors.name}</p>
                    )}
                  </div>

                  {/* Email Address */}
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email" className="text-xs sm:text-sm font-medium text-foreground">
                      Email Address
                    </Label>
                    <Input
                      ref={emailInputRef}
                      id="signup-email"
                      type="email"
                      placeholder="student@school.edu"
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
                    <Label htmlFor="signup-password" className="text-xs sm:text-sm font-medium text-foreground">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        ref={passwordInputRef}
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 8 letters & numbers"
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
                        autoComplete="new-password"
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
                    {fieldErrors.password ? (
                      <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        At least 8 characters with a mix of letters and numbers.
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full h-11 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Create Account <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              {/* -------------------- FORGOT PASSWORD FORM -------------------- */}
              {mode === 'forgot' && (
                <form onSubmit={handleForgotPassword} className="space-y-4" noValidate>
                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className="text-xs sm:text-sm font-medium text-foreground">
                      Email Address
                    </Label>
                    <Input
                      ref={emailInputRef}
                      id="forgot-email"
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

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full h-11 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                    disabled={loading || forgotCooldown > 0}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending Reset Instructions...
                      </>
                    ) : forgotCooldown > 0 ? (
                      `Resend in ${forgotCooldown}s`
                    ) : (
                      <>
                        Send Reset Link <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>

          {/* Bottom Footer Switcher */}
          <div className="mt-8 pt-4 border-t border-border/50 text-center space-y-2">
            <div className="space-y-1">
              {mode === 'signin' ? (
                <p className="text-xs text-muted-foreground">
                  Need a student account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="text-primary font-semibold hover:underline cursor-pointer"
                  >
                    Sign Up
                  </button>
                </p>
              ) : mode === 'signup' ? (
                <p className="text-xs text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-primary font-semibold hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Remember your password?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-primary font-semibold hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              )}
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

