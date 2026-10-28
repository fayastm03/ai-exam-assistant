'use client';

import React, { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-3 sm:p-6 bg-slate-50/60 dark:bg-background">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
        <AuthCard initialMode="forgot" />
      </Suspense>
    </main>
  );
}
