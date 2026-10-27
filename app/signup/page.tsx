'use client';

import React, { useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppMessage } from '@/components/ui/app-message';
import { GraduationCap, Loader2, ArrowRight } from 'lucide-react';
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
      errors.name = 'Please enter your full name.';
    }

    if (!cleanEmail) {
      errors.email = 'Please enter your email address.';
    } else if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      errors.email = 'Please enter a valid email address.';
    }

    // Password rule: at least 8 characters long and contain a mix of letters and numbers
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

      // STRICT SECURITY: Role is always student
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

      // Check if email confirmation is required
      if (data.user && (!data.session || !data.user.email_confirmed_at)) {
        const checkEmailUrl = `/signup/check-email?email=${encodeURIComponent(email.trim())}${
          next ? `&next=${encodeURIComponent(next)}` : ''
        }`;
        router.push(checkEmailUrl);
        return;
      }

      // If automatically confirmed or session established, proceed to student destination
      router.push(next && next.startsWith('/') ? next : '/exams');
    } catch (err: unknown) {
      setPageMessage(mapAuthError(err));
      setLoading(false);
    }
  };

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login';

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4 py-8">
      <Card className="w-full max-w-md shadow-lg border-neutral-200/80 dark:border-neutral-800">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold tracking-tight">
              Create Student Account
            </CardTitle>
            <CardDescription className="text-xs text-neutral-500">
              Sign up to take exams, track your progress, and review teacher feedback.
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSignup} noValidate>
          <CardContent className="space-y-4">
            {pageMessage && <AppMessage message={pageMessage} />}

            <div className="space-y-1.5">
              <Label htmlFor="signup-name" className="text-xs font-medium">
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
                className={cn(fieldErrors.name && 'border-red-500 focus-visible:ring-red-400')}
              />
              {fieldErrors.name && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-email" className="text-xs font-medium">
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
                className={cn(fieldErrors.email && 'border-red-500 focus-visible:ring-red-400')}
              />
              {fieldErrors.email && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-password" className="text-xs font-medium">
                Password
              </Label>
              <Input
                ref={passwordInputRef}
                id="signup-password"
                type="password"
                placeholder="At least 8 characters with letters & numbers"
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
                className={cn(fieldErrors.password && 'border-red-500 focus-visible:ring-red-400')}
              />
              {fieldErrors.password ? (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.password}</p>
              ) : (
                <p className="text-[11px] text-neutral-500">
                  Must be at least 8 characters long and contain a mix of letters and numbers.
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex-col gap-3 pt-2">
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
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

            <div className="text-center text-xs text-neutral-500 pt-1">
              Already have an account?{' '}
              <Link href={loginHref} className="text-blue-600 hover:underline font-medium">
                Sign in
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="text-sm text-neutral-500">Loading...</div>}>
      <StudentSignupForm />
    </Suspense>
  );
}
