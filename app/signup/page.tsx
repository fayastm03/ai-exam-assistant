'use client';

import React, { useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppMessage } from '@/components/ui/app-message';
import { GraduationCap, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mapAuthError, type UserMessage, MESSAGES } from '@/lib/messages';

function StudentSignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [pageMessage, setPageMessage] = useState<UserMessage | null>(null);

  const validateFields = (): boolean => {
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

    if (errors.name) {
      nameInputRef.current?.focus();
      return false;
    }
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageMessage(null);

    if (!validateFields()) {
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const origin = window.location.origin;

      const callbackUrl = next
        ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
        : `${origin}/auth/callback`;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
            full_name: name.trim(),
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
        const checkEmailUrl = `/signup/check-email?email=${encodeURIComponent(email.trim())}${
          next ? `&next=${encodeURIComponent(next)}` : ''
        }`;
        router.push(checkEmailUrl);
        return;
      }

      router.push(next && next.startsWith('/') ? next : '/exams');
    } catch (err: unknown) {
      setPageMessage(mapAuthError(err));
      setLoading(false);
    }
  };

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login';

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-left space-y-1">
        <div className="flex items-center gap-2 mb-2 text-primary font-bold text-lg">
          <GraduationCap className="w-6 h-6" />
          <span>AI Exam Assistant</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Create Student Account
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign up to take scheduled exams and view feedback.
        </p>
      </div>

      <Card className="rounded-lg border border-border shadow-sm bg-card">
        <form onSubmit={handleSignup} noValidate>
          <CardContent className="p-6 space-y-4">
            {pageMessage && <AppMessage message={pageMessage} />}

            <div className="space-y-1.5">
              <Label htmlFor="signup-name" className="text-sm font-medium">
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
                  if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }}
                disabled={loading}
                autoComplete="name"
                aria-invalid={!!fieldErrors.name}
                className={cn(
                  'h-10 text-base rounded-lg',
                  fieldErrors.name && 'border-destructive focus-visible:ring-destructive'
                )}
              />
              {fieldErrors.name && (
                <p className="text-xs text-destructive mt-1">{fieldErrors.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-email" className="text-sm font-medium">
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
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                disabled={loading}
                autoComplete="email"
                aria-invalid={!!fieldErrors.email}
                className={cn(
                  'h-10 text-base rounded-lg',
                  fieldErrors.email && 'border-destructive focus-visible:ring-destructive'
                )}
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-password" className="text-sm font-medium">
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
                  disabled={loading}
                  autoComplete="new-password"
                  aria-invalid={!!fieldErrors.password}
                  className={cn(
                    'h-10 text-base rounded-lg pr-10',
                    fieldErrors.password && 'border-destructive focus-visible:ring-destructive'
                  )}
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
              {fieldErrors.password ? (
                <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  At least 8 characters with a mix of letters and numbers.
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10 text-base font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>

          <CardFooter className="px-6 py-4 border-t border-border bg-muted/30 rounded-b-lg text-center justify-center text-xs text-muted-foreground">
            <span>
              Already have an account?{' '}
              <Link href={loginHref} className="text-primary font-semibold hover:underline">
                Sign in
              </Link>
            </span>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
        <StudentSignupForm />
      </Suspense>
    </main>
  );
}
