'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateReferenceId } from '@/lib/messages';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [refId] = useState(() => error.digest || generateReferenceId());

  useEffect(() => {
    // Keep technical error details strictly in client console / server telemetry
    console.error(`[Application Error Ref: ${refId}]`, error);
  }, [error, refId]);

  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-200 dark:border-red-900">
          <AlertCircle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Something Went Wrong
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
            An unexpected problem occurred while loading this page. Our team has logged the details. Please try again shortly.
          </p>
          <p className="text-xs font-mono text-neutral-400 dark:text-neutral-500 pt-1">
            Reference: {refId}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            type="button"
            variant="default"
            onClick={() => reset()}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Try Again
          </Button>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'w-full sm:w-auto h-9'
            )}
          >
            <Home className="w-4 h-4 mr-1.5" />
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}
