import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateStudentFeedback } from '@/lib/ai/student-feedback';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POST /api/teacher/exams/[id]/bulk-ai-feedback
 * Batch generates student automated AI feedback for all submitted attempts missing it.
 *
 * Rules:
 *  - Guard: Only the teacher who owns the exam can run bulk generation.
 *  - Finds all submitted or auto_submitted attempts without an ai_auto or auto_template row.
 *  - Batches of at most 20 attempts per request.
 *  - 1-second pause between attempts.
 *  - Skips non-rate-limit failures, increments failure counter.
 *  - Stops immediately on rate-limit (429) and reports rate-limit status to client.
 *  - Do NOT insert template rows in bulk mode (skipTemplateFallback = true).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  // 1. Verify exam exists and teacher owns it
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id, title')
    .eq('id', examId)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found', 404);
  }

  if (exam.teacher_id !== auth.user.id) {
    return jsonError('Access denied: You can only generate feedback for your own exams', 403);
  }

  // 2. Fetch all submitted or auto_submitted attempts
  const { data: attempts, error: attemptsError } = await supabase
    .from('attempts')
    .select('id, status')
    .eq('exam_id', examId)
    .in('status', ['submitted', 'auto_submitted']);

  if (attemptsError) {
    return jsonError('Failed to fetch attempts', 500);
  }

  const allSubmittedAttempts = attempts || [];
  if (allSubmittedAttempts.length === 0) {
    return jsonSuccess({
      done: true,
      batchProcessed: 0,
      failedCount: 0,
      totalRemaining: 0,
      totalSubmitted: 0,
      totalWithFeedback: 0,
      rateLimited: false,
      message: 'No submitted attempts found for this exam.',
    });
  }

  // 3. Find attempts that already have ai_auto or auto_template overall feedback
  const attemptIds = allSubmittedAttempts.map((a) => a.id);
  const { data: existingFeedbackRows } = await supabase
    .from('attempt_feedback')
    .select('attempt_id')
    .in('attempt_id', attemptIds)
    .is('question_id', null)
    .in('source', ['ai_auto', 'auto_template']);

  const attemptsWithFeedback = new Set(
    (existingFeedbackRows || []).map((r) => r.attempt_id)
  );

  const pendingAttempts = allSubmittedAttempts.filter(
    (a) => !attemptsWithFeedback.has(a.id)
  );

  if (pendingAttempts.length === 0) {
    return jsonSuccess({
      done: true,
      batchProcessed: 0,
      failedCount: 0,
      totalRemaining: 0,
      totalSubmitted: allSubmittedAttempts.length,
      totalWithFeedback: allSubmittedAttempts.length,
      rateLimited: false,
      message: 'All submitted student attempts already have AI feedback.',
    });
  }

  // 4. Take a batch of at most 20 attempts
  const batchSize = 20;
  const batch = pendingAttempts.slice(0, batchSize);

  let processedCount = 0;
  let failedCount = 0;
  let rateLimited = false;

  for (let i = 0; i < batch.length; i++) {
    const attempt = batch[i];

    try {
      // Rule: Do not insert template rows in bulk mode
      await generateStudentFeedback(attempt.id, { skipTemplateFallback: true });
      processedCount++;
    } catch (err: unknown) {
      const isRateLimit =
        typeof err === 'object' && err !== null && 'isRateLimit' in err
          ? Boolean((err as { isRateLimit?: boolean }).isRateLimit)
          : String(err).toLowerCase().includes('rate limit') ||
            String(err).toLowerCase().includes('429');

      if (isRateLimit) {
        rateLimited = true;
        break; // Stop immediately on AI rate limit
      } else {
        failedCount++;
        console.warn(`[BulkAI] Failed attempt ${attempt.id}:`, err);
      }
    }

    // 1-second pause between attempts
    if (i < batch.length - 1 && !rateLimited) {
      await sleep(1000);
    }
  }

  const remainingAfterBatch = pendingAttempts.length - processedCount - failedCount;

  return jsonSuccess({
    done: remainingAfterBatch <= 0 && !rateLimited,
    batchProcessed: processedCount,
    failedCount,
    rateLimited,
    totalRemaining: remainingAfterBatch,
    totalSubmitted: allSubmittedAttempts.length,
    totalWithFeedback: attemptsWithFeedback.size + processedCount,
    message: rateLimited
      ? 'Rate limit reached, try again in a minute'
      : remainingAfterBatch <= 0
        ? 'Bulk generation complete'
        : `Processed ${processedCount} attempts`,
  });
}

