'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GraduationCap, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
        }
      } catch {
        setHasSession(false);
      } finally {
        setCheckingSession(false);
      }
    }

    verifyAuth();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
      } else {
        setSuccess(true);
        setLoading(false);

        // Sign out to enforce clean login with the new credentials
        await supabase.auth.signOut();

        setTimeout(() => {
          router.push('/login?success=reset_success');
        }, 2000);
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to update password. Please try again.'
      );
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
            Set New Password
          </p>
        </div>

        <Card className="shadow-lg border-neutral-200/80 dark:border-neutral-800">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Reset Your Password
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Enter and confirm your new account password
            </p>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            {checkingSession ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <p className="text-xs text-neutral-500">Verifying reset session...</p>
              </div>
            ) : !hasSession && !success ? (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <p className="font-semibold text-sm">Invalid or Expired Link</p>
                    <p>
                      The password reset link is invalid or has expired. Please request a new link to
                      reset your password.
                    </p>
                  </div>
                </div>
                <div className="pt-1">
                  <Link
                    href="/forgot-password"
                    className="inline-flex items-center justify-center w-full text-xs h-8 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/80 transition-colors"
                  >
                    Request New Reset Link
                  </Link>
                </div>
              </div>
            ) : success ? (
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                    <p className="font-semibold text-sm">Password Updated!</p>
                    <p>
                      Your password has been changed successfully. Redirecting you to the sign-in
                      page...
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {errorMsg && (
                  <Alert variant="destructive" className="py-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <AlertDescription className="text-xs ml-2">{errorMsg}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-password">New Password</Label>
                    <Input
                      id="reset-password"
                      type="password"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      disabled={loading}
                    />
                  </div>

                  <Button type="submit" className="w-full mt-2" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Password...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardContent>

          <CardFooter className="pt-0 pb-4 text-center justify-center">
            <Link
              href="/login"
              className="inline-flex items-center text-xs text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
