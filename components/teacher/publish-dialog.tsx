'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, AlertCircle, Send, Loader2 } from 'lucide-react';

interface PublishDialogProps {
  examId: string;
  isPublished: boolean;
  onPublishedSuccess: (updatedExam: { id: string; status: 'draft' | 'published' | 'closed'; [key: string]: unknown }) => void;
}

export function PublishButtonWithDialog({
  examId,
  isPublished,
  onPublishedSuccess,
}: PublishDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);

  const handlePublish = async () => {
    setLoading(true);
    setErrorDetails([]);

    try {
      const res = await fetch(`/api/teacher/exams/${examId}/publish`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        const details = Array.isArray(data.details)
          ? data.details
          : [data.message || 'Validation failed.'];
        setErrorDetails(details);
        setErrorModalOpen(true);
        return;
      }

      onPublishedSuccess(data.exam);
    } catch (err: unknown) {
      setErrorDetails([
        err instanceof Error ? err.message : 'An unexpected error occurred while communicating with the server.',
      ]);
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  if (isPublished) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-700 dark:text-emerald-300 h-9"
      >
        <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
        Exam is Published
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={handlePublish}
        disabled={loading}
        size="sm"
        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm h-9"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            Validating...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-1.5" />
            Publish Exam
          </>
        )}
      </Button>

      {/* Clear Publish Errors Dialog */}
      <Dialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg text-red-600">Publish Validation Blocked</DialogTitle>
            <DialogDescription className="text-xs">
              This exam cannot be published until all examination criteria are satisfied.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs font-semibold">Publish Checklist Requirements:</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                The platform requires that an exam has a positive duration, at least 1 question, and each question has
                2+ options with a valid matching correct answer.
              </AlertDescription>
            </Alert>

            <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                Issues to resolve ({errorDetails.length}):
              </h4>
              <ul className="space-y-1.5 text-xs text-red-600 dark:text-red-400">
                {errorDetails.map((err, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>{err}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setErrorModalOpen(false)}>
              Understood, Back to Editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
