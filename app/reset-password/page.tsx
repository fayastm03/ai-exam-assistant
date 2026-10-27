'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppMessage } from '@/components/ui/app-message';
import { GraduationCap, ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mapAuthError, type UserMessage, MESSAGES } from '@/lib/messages';

export default function ResetPasswordPage() {
  const router = useRouter();

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [pageMessage, setPageMessage] = useState<UserMessage | null>(null);

  useEffect(() => {
    async function verifyAuth() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          setHasSession(true);
        } else {
          setHasSession(false);
          setPageMessage(MESSAGES.auth.linkExpiredOrUsed);
        }
      } catch {
        setHasSession(false);
        setPageMessage(MESSAGES.auth.linkExpiredOrUsed);
      } finally {
        setCheckingSession(false);
      }
    }

    verifyAuth();
  }, []);

  const validateFields = (): boolean => {
    const errors: { password?: string; confirmPassword?: string } = {};

    const hasLetters = /[a-zA-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);

    if (password.length < 8 || !hasLetters || !hasNumbers) {
      errors.password = MESSAGES.auth.passwordWeak.message;
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match. Check both fields and try again.';
    }

    setFieldErrors(errors);

    if (errors.password) {
      passwordInputRef.current?.focus();
      return false;
    }
    if (errors.confirmPassword) {
      confirmPasswordInputRef.current?.focus();
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageMessage(null);

    if (!validateFields()) {
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setPageMessage(mapAuthError(error));
        setLoading(false);
      } else {
        setPageMessage({
          type: 'success',
          message: MESSAGES.success.passwordUpdated,
        });
        setLoading(false);

        // Sign out to enforce clean login with the new credentials
        await supabase.auth.signOut();

        setTimeout(() => {
          router.push('/login?success=reset_success');
        }, 1500);
      }
    } catch (err: unknown) {
      setPageMessage(mapAuthError(err));
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white mb-3 shadow-md shadow-blue-500/20">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            AI Exam Assistant
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Create New Password
          </p>
        </div>

        <Card className="shadow-lg border-neutral-200/80 dark:border-neutral-800">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Reset Password
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Enter your new account password below
            </p>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            {pageMessage && (
              <AppMessage
                message={pageMessage}
                actionLabel={pageMessage.actionLabel}
                onAction={() => router.push('/forgot-password')}
              />
            )}

            {checkingSession ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <p className="text-xs text-neutral-500">Verifying security token...</p>
              </div>
            ) : !hasSession && !pageMessage ? (
              <AppMessage
                message={MESSAGES.auth.linkExpiredOrUsed}
                actionLabel="Request new link"
                onAction={() => router.push('/forgot-password')}
              />
            ) : hasSession ? (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    ref={passwordInputRef}
                    id="new-password"
                    type="password"
                    placeholder="At least 8 characters with letters & numbers"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    autoComplete="new-password"
                    disabled={loading}
                    aria-invalid={!!fieldErrors.password}
                    className={cn(fieldErrors.password && 'border-red-500 focus-visible:ring-red-400')}
                  />
                  {fieldErrors.password ? (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {fieldErrors.password}
                    </p>
                  ) : (
                    <p className="text-[11px] text-neutral-500">
                      Must be at least 8 characters long and contain a mix of letters and numbers.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                  <Input
                    ref={confirmPasswordInputRef}
                    id="confirm-new-password"
                    type="password"
                    placeholder="Repeat your new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                      }
                    }}
                    autoComplete="new-password"
                    disabled={loading}
                    aria-invalid={!!fieldErrors.confirmPassword}
                    className={cn(fieldErrors.confirmPassword && 'border-red-500 focus-visible:ring-red-400')}
                  />
                  {fieldErrors.confirmPassword && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    'Set New Password'
                  )}
                </Button>
              </form>
            ) : null}
          </CardContent>

          <CardFooter className="pt-0 pb-4 text-center justify-center">
            <Link
              href="/login"
              className="inline-flex items-center text-xs text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 font-medium"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
