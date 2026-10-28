'use client';

import React, { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { SilkShaderBackground } from '@/components/auth/silk-shader-background';

export default function LoginPage() {
  return (
    <main className="min-h-screen relative flex items-center justify-center p-3 sm:p-6 bg-slate-50/40 dark:bg-background">
      <SilkShaderBackground />
      <div className="relative z-10 w-full flex items-center justify-center">
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
          <AuthCard initialMode="signin" />
        </Suspense>
      </div>
    </main>
  );
}

