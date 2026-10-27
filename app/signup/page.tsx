'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GraduationCap, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

function StudentSignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const origin = window.location.origin;

      const callbackUrl = next
        ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
        : `${origin}/auth/callback`;

      // STRICT SECURITY: We never pass role: 'teacher'. Role is always 'student'.
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
        setErrorMsg(error.message);
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

      // If automatically confirmed or already confirmed, proceed to student destination
      router.push(next && next.startsWith('/') ? next : '/exams');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred during sign up.');
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

        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="signup-name" className="text-xs font-medium">
                Full Name *
              </Label>
              <Input
                id="signup-name"
                type="text"
                required
                placeholder="Alex Johnson"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                autoComplete="name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-email" className="text-xs font-medium">
                Email Address *
              </Label>
              <Input
                id="signup-email"
                type="email"
                required
                placeholder="alex@student.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-password" className="text-xs font-medium">
                Password *
              </Label>
              <Input
                id="signup-password"
                type="password"
                required
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
              <p className="text-[11px] text-neutral-400">Must be at least 6 characters.</p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </>
              )}
            </Button>
          </CardContent>

          <CardFooter className="flex flex-col space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-900 text-center text-xs text-neutral-500">
            <div>
              Already have an account?{' '}
              <Link href={loginHref} className="text-blue-600 hover:underline font-medium">
                Sign In
              </Link>
            </div>
            <p className="text-[11px] text-neutral-400">
              Teacher accounts are managed directly by administration via SQL.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function StudentSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <StudentSignupForm />
    </Suspense>
  );
}
