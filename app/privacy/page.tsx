import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy | AI Exam Assistant',
  description: 'Privacy Policy and data protection commitments for students and teachers.',
};

export default function PrivacyPage() {
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
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
            <p className="text-xs text-muted-foreground">Effective Date: November 2, 2026</p>
          </div>
        </div>

        <section className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <h2 className="text-base font-semibold text-foreground">1. Overview</h2>
          <p>
            AI Exam Assistant is dedicated to safeguarding student and educator data privacy.
            This policy outlines how personal and academic data is collected, stored, and processed.
          </p>

          <h2 className="text-base font-semibold text-foreground">2. Student Data Privacy & Exam Integrity</h2>
          <p>
            During exam sessions, answer submissions, timestamps, and exam security metrics (such as window focus state)
            are recorded strictly for test integrity and scoring. Student names and emails are never shared with external
            AI services; AI evaluations are performed on anonymized question data.
          </p>

          <h2 className="text-base font-semibold text-foreground">3. Data Retention & Deletion</h2>
          <p>
            Users retain the right to request deletion of their account and historical test records.
            Account deletion requests can be submitted by contacting school administrators or our privacy contact below.
          </p>

          <h2 className="text-base font-semibold text-foreground">4. Contact Information</h2>
          <p>
            For privacy inquiries or data rights requests, contact: <strong className="text-foreground">privacy@ai-exam-assistant.edu</strong>
          </p>
        </section>
      </div>
    </div>
  );
}
