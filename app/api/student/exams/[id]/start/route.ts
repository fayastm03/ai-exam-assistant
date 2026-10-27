import { NextRequest } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/student/exams/[id]/start
 * Starts a new exam attempt or returns the ongoing attempt.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  // 1. Fetch published exam
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, title, duration_min, status, open_at, close_at')
    .eq('id', examId)
    .eq('status', 'published')
    .single();

  if (examError || !exam) {
    return jsonError('Exam is not available or not published', 404);
  }

  const now = new Date();

  // 2. Check for existing attempt first:
  // If an attempt is already in progress or submitted, resume it (allows a student removed
  // from class mid-test to finish an ongoing attempt and view old results).
  const { data: existingAttempt } = await supabase
    .from('attempts')
    .select('*')
    .eq('exam_id', examId)
    .eq('student_id', auth.user.id)
    .maybeSingle();

  if (existingAttempt) {
    if (existingAttempt.status === 'submitted' || existingAttempt.status === 'auto_submitted') {
      return jsonSuccess({
        alreadySubmitted: true,
        attempt: existingAttempt,
        serverTime: now.toISOString(),
      });
    }

    return jsonSuccess({
      alreadySubmitted: false,
      isResumed: true,
      attempt: existingAttempt,
      serverTime: now.toISOString(),
    });
  }

  // 3. For NEW attempts: Validate schedule and class approval
  if (exam.open_at && new Date(exam.open_at) > now) {
    return jsonError('This exam is not open yet', 400);
  }
  if (exam.close_at && new Date(exam.close_at) < now) {
    return jsonError('This exam is closed', 400);
  }

  // Check that the student is approved in a class the exam is assigned to
  const { data: assignedClasses, error: assignError } = await supabase
    .from('exam_classes')
    .select('class_id')
    .eq('exam_id', examId);

  if (assignError) {
    return jsonError(assignError.message, 500);
  }

  const assignedClassIds = (assignedClasses || []).map((c) => c.class_id);
  if (assignedClassIds.length === 0) {
    return jsonError('Access denied: This exam is not assigned to any class', 403);
  }

  const { data: approvedMembership, error: memberCheckError } = await supabase
    .from('class_members')
    .select('id')
    .in('class_id', assignedClassIds)
    .eq('student_id', auth.user.id)
    .eq('status', 'approved')
    .limit(1);

  if (memberCheckError) {
    return jsonError(memberCheckError.message, 500);
  }

  if (!approvedMembership || approvedMembership.length === 0) {
    return jsonError(
      'Access denied: You must be an approved member of a class assigned to this exam',
      403
    );
  }

  // 4. Create new attempt
  // Deadline = now + duration_min minutes
  let deadline = new Date(now.getTime() + exam.duration_min * 60 * 1000);

  // If exam has a close_at time that comes before duration expires, clamp to close_at
  if (exam.close_at && new Date(exam.close_at) < deadline) {
    deadline = new Date(exam.close_at);
  }

  const { data: newAttempt, error: createError } = await supabase
    .from('attempts')
    .insert({
      exam_id: examId,
      student_id: auth.user.id,
      started_at: now.toISOString(),
      deadline_at: deadline.toISOString(),
      status: 'in_progress',
    })
    .select()
    .single();

  if (createError) {
    // Edge Case 7: Handle race conditions from starting twice at the exact same moment
    if (createError.code === '23505' || createError.message?.toLowerCase().includes('unique')) {
      const { data: parallelAttempt } = await supabase
        .from('attempts')
        .select('*')
        .eq('exam_id', examId)
        .eq('student_id', auth.user.id)
        .single();

      if (parallelAttempt) {
        return jsonSuccess({
          alreadySubmitted:
            parallelAttempt.status === 'submitted' ||
            parallelAttempt.status === 'auto_submitted',
          isResumed: true,
          attempt: parallelAttempt,
          serverTime: now.toISOString(),
        });
      }
    }
    return jsonError(createError.message, 500);
  }

  return jsonSuccess(
    {
      alreadySubmitted: false,
      isResumed: false,
      attempt: newAttempt,
      serverTime: now.toISOString(),
    },
    201
  );
}

