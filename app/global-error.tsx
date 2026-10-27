'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { generateReferenceId } from '@/lib/messages';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [refId] = useState(() => error.digest || generateReferenceId());

  useEffect(() => {
    console.error(`[Root Global Error Ref: ${refId}]`, error);
  }, [error, refId]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center p-4 bg-neutral-50 text-neutral-900 font-sans">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-bold text-2xl border border-red-200">
            !
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Something Went Wrong</h1>
            <p className="text-sm text-neutral-600 max-w-sm mx-auto leading-relaxed">
              An unexpected problem occurred while loading the application. Our team has logged the details.
            </p>
            <p className="text-xs font-mono text-neutral-400 pt-1">Reference: {refId}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 font-medium text-sm rounded-lg transition-colors text-center"
            >
              Return Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}

