import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service | AI Exam Assistant',
  description: 'Terms of Service governing the use of AI Exam Assistant.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-card border border-border p-8 rounded-2xl shadow-sm space-y-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Sign In
        </Link>

        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Terms of Service</h1>
            <p className="text-xs text-muted-foreground">Effective Date: November 2, 2026</p>
          </div>
        </div>

        <section className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <h2 className="text-base font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p>
            By accessing or using AI Exam Assistant, students and educators agree to be bound by these Terms of Service.
          </p>

          <h2 className="text-base font-semibold text-foreground">2. Academic Integrity & Fair Use</h2>
          <p>
            Students agree to take exams fairly without external unauthorized assistance, tab switching, or automated solvers.
            Circumventing exam lockdown features is a violation of academic policy.
          </p>

          <h2 className="text-base font-semibold text-foreground">3. Teacher Responsibilities</h2>
          <p>
            Educators are responsible for reviewing AI-suggested questions and feedback prior to final grade distribution.
          </p>

          <h2 className="text-base font-semibold text-foreground">4. Support Contact</h2>
          <p>
            For support or questions regarding these terms: <strong className="text-foreground">support@ai-exam-assistant.edu</strong>
          </p>
        </section>
      </div>
    </div>
  );
}
