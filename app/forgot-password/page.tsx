'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GraduationCap, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccess(false);

    try {
      const supabase = createClient();
      const origin =
        typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : '';

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccess(true);
        setCooldown(60);
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to send password reset email. Please try again.'
      );
    } finally {
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
            Account Recovery
          </p>
        </div>

        <Card className="shadow-lg border-neutral-200/80 dark:border-neutral-800">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Forgot Password
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Enter your email address to receive a password reset link
            </p>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            {errorMsg && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <AlertDescription className="text-xs ml-2">{errorMsg}</AlertDescription>
              </Alert>
            )}

            {success ? (
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                    <p className="font-semibold text-sm">Check your email</p>
                    <p>
                      If an account exists for <span className="font-medium underline">{email}</span>,
                      we have sent password reset instructions to your inbox.
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      The link expires in 1 hour. Be sure to check your spam or junk folder.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={loading || cooldown > 0}
                    className="w-full text-xs h-8"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Resending...
                      </>
                    ) : cooldown > 0 ? (
                      `Resend in ${cooldown}s`
                    ) : (
                      'Resend Reset Link'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Email Address</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="student@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>

                <Button type="submit" className="w-full mt-2" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Link...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </form>
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
