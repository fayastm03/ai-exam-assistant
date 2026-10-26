'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GraduationCap, BookOpen, AlertCircle, Loader2 } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Derive initial error message directly from searchParams without an effect
  const errorParam = searchParams.get('error');
  const urlError =
    errorParam === 'auth_required'
      ? 'Please sign in to access this page.'
      : errorParam === 'session_expired'
      ? 'Your session has expired. Please sign in again.'
      : errorParam === 'teacher_required'
      ? 'Access denied: You must be a teacher to view the teacher dashboard.'
      : errorParam === 'student_required'
      ? 'Access denied: You must be signed in as a student to access the student portal.'
      : null;

  const activeError = errorMsg || urlError;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Fetch user profile to determine role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        const userRole = profile?.role ?? data.user.user_metadata?.role ?? 'student';

        if (userRole === 'teacher') {
          router.push('/teacher/exams');
        } else {
          router.push('/exams');
        }
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to sign in. Please try again.');
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            role,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      // Check if session was created immediately or confirmation required
      if (data.session) {
        if (role === 'teacher') {
          router.push('/teacher/exams');
        } else {
          router.push('/exams');
        }
        router.refresh();
      } else {
        setSuccessMsg('Account created successfully! Please check your email to confirm your account or sign in.');
        setActiveTab('signin');
        setLoading(false);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to register. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white mb-3 shadow-md shadow-blue-500/20">
          <GraduationCap className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          AI Exam Assistant
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Server-timed MCQ examination platform
        </p>
      </div>

      <Card className="shadow-lg border-neutral-200/80 dark:border-neutral-800">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'signin' | 'signup')}>
          <CardHeader className="pb-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            {activeError && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{activeError}</AlertDescription>
              </Alert>
            )}

            {successMsg && (
              <Alert className="py-2.5 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
                <AlertDescription className="text-xs">{successMsg}</AlertDescription>
              </Alert>
            )}

            <TabsContent value="signin" className="mt-0 space-y-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email">Email Address</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="teacher@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>

                <Button type="submit" className="w-full mt-2" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-0 space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Dr. Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email Address</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="teacher@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
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
                  <Label>I am a:</Label>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setRole('teacher')}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all ${
                        role === 'teacher'
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-600'
                          : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/50'
                      }`}
                    >
                      <GraduationCap className="w-5 h-5 mb-1" />
                      Teacher
                      <span className="text-[10px] text-neutral-500 font-normal">Create & mark exams</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all ${
                        role === 'student'
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-600'
                          : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/50'
                      }`}
                    >
                      <BookOpen className="w-5 h-5 mb-1" />
                      Student
                      <span className="text-[10px] text-neutral-500 font-normal">Take exams</span>
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full mt-2" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    `Sign Up as ${role === 'teacher' ? 'Teacher' : 'Student'}`
                  )}
                </Button>
              </form>
            </TabsContent>
          </CardContent>

          <CardFooter className="pt-0 pb-4 text-center justify-center">
            <p className="text-xs text-neutral-500">
              {activeTab === 'signin' ? "Don't have an account yet?" : 'Already registered?'}{' '}
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'signin' ? 'signup' : 'signin')}
                className="text-blue-600 font-semibold hover:underline"
              >
                {activeTab === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </CardFooter>
        </Tabs>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-neutral-50 dark:bg-neutral-950">
      <Suspense fallback={<div className="text-sm text-neutral-500">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
