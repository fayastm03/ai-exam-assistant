'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
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
      errors.confirmPassword = 'Confirm your new password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
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
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background">
      <div className="w-full max-w-sm mx-auto space-y-6">
        <div className="text-left space-y-1">
          <div className="flex items-center gap-2 mb-2 text-primary font-bold text-lg">
            <GraduationCap className="w-6 h-6" />
            <span>AI Exam Assistant</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Reset Password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your new password below.
          </p>
        </div>

        <Card className="rounded-lg border border-border shadow-sm bg-card">
          <CardContent className="p-6 space-y-4">
            {pageMessage && (
              <AppMessage
                message={pageMessage}
                actionLabel={pageMessage.actionLabel}
                onAction={() => router.push('/forgot-password')}
              />
            )}

            {checkingSession ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-2 text-muted-foreground text-sm">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <p>Verifying link...</p>
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
                  <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
                  <Input
                    ref={passwordInputRef}
                    id="new-password"
                    type="password"
                    placeholder="At least 8 letters & numbers"
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
                    className={cn(
                      'h-10 text-base rounded-lg',
                      fieldErrors.password && 'border-destructive focus-visible:ring-destructive'
                    )}
                  />
                  {fieldErrors.password ? (
                    <p className="text-xs text-destructive mt-1">
                      {fieldErrors.password}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      At least 8 characters with letters and numbers.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-new-password" className="text-sm font-medium">Confirm New Password</Label>
                  <Input
                    ref={confirmPasswordInputRef}
                    id="confirm-new-password"
                    type="password"
                    placeholder="Repeat new password"
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
                    className={cn(
                      'h-10 text-base rounded-lg',
                      fieldErrors.confirmPassword && 'border-destructive focus-visible:ring-destructive'
                    )}
                  />
                  {fieldErrors.confirmPassword && (
                    <p className="text-xs text-destructive mt-1">
                      {fieldErrors.confirmPassword}
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
                      Updating Password...
                    </>
                  ) : (
                    'Set New Password'
                  )}
                </Button>
              </form>
            ) : null}
          </CardContent>

          <CardFooter className="px-6 py-4 border-t border-border bg-muted/30 rounded-b-lg text-center justify-center">
            <Link
              href="/login"
              className="text-xs text-muted-foreground hover:text-foreground font-medium inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
