'use client';

import React, { useState, useRef } from 'react';
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

export default function ForgotPasswordPage() {
  const emailInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageMessage, setPageMessage] = useState<UserMessage | null>(null);
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
      setFieldError('Enter your email address.');
      emailInputRef.current?.focus();
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFieldError('Enter a valid email address.');
      emailInputRef.current?.focus();
      return;
    }

    setFieldError(null);
    setLoading(true);
    setPageMessage(null);

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
        setPageMessage(mapAuthError(error));
      } else {
        setPageMessage({
          type: 'success',
          message: MESSAGES.success.passwordResetSent,
        });
        setCooldown(60);
      }
    } catch (err: unknown) {
      setPageMessage(mapAuthError(err));
    } finally {
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
            Account Recovery
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email address to receive password reset instructions.
          </p>
        </div>

        <Card className="rounded-lg border border-border shadow-sm bg-card">
          <form onSubmit={handleSubmit} noValidate>
            <CardContent className="p-6 space-y-4">
              {pageMessage && <AppMessage message={pageMessage} />}

              <div className="space-y-1.5">
                <Label htmlFor="recovery-email" className="text-sm font-medium">
                  Email Address
                </Label>
                <Input
                  ref={emailInputRef}
                  id="recovery-email"
                  type="email"
                  placeholder="you@school.edu"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldError) setFieldError(null);
                  }}
                  autoComplete="email"
                  disabled={loading}
                  aria-invalid={!!fieldError}
                  className={cn(
                    'h-10 text-base rounded-lg',
                    fieldError && 'border-destructive focus-visible:ring-destructive'
                  )}
                />
                {fieldError && (
                  <p className="text-xs text-destructive mt-1">{fieldError}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-10 text-base font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer mt-2"
                disabled={loading || cooldown > 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Instructions...
                  </>
                ) : cooldown > 0 ? (
                  `Resend in ${cooldown}s`
                ) : (
                  'Send Reset Link'
                )}
              </Button>
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
          </form>
        </Card>
      </div>
    </main>
  );
}
