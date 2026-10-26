import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Validates options structure for a question.
 * Returns array of option IDs/keys if valid, or null.
 */
function extractOptionKeys(options: unknown): string[] {
  if (Array.isArray(options)) {
    return options
      .map((opt) => {
        if (typeof opt === 'object' && opt !== null && 'id' in opt) {
          return String(opt.id).trim().toUpperCase();
        }
        if (typeof opt === 'string') {
          return opt.trim().toUpperCase();
        }
        return '';
      })
      .filter((k) => k.length > 0);
  }

  if (typeof options === 'object' && options !== null) {
    return Object.keys(options).map((k) => k.trim().toUpperCase());
  }

  return [];
}

/**
 * POST /api/teacher/exams/[id]/publish
 * Publishes an exam owned by the authenticated teacher.
 * Blocked unless:
 *   1. Exam has a valid duration set (duration_min > 0).
 *   2. Exam has at least one question.
 *   3. Every question has 2 or more options.
 *   4. Every question has exactly one valid correct option matching one of its options.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const supabase = createServiceRoleClient();

  // 1. Fetch exam and verify teacher ownership
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('*')
    .eq('id', id)
    .eq('teacher_id', auth.user.id)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found or you do not have permission to publish it', 404);
  }

  // Check if already published
  if (exam.status === 'published') {
    return jsonSuccess({
      message: 'Exam is already published',
      exam,
    });
  }

  const errors: string[] = [];

  // 2. Validate duration is set
  if (!exam.duration_min || exam.duration_min <= 0) {
    errors.push('Exam duration is required and must be greater than 0 minutes.');
  }

  // 3. Fetch questions
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_id', id)
    .order('number', { ascending: true });

  if (questionsError) {
    return jsonError(questionsError.message, 500);
  }

  // Validate at least one question
  if (!questions || questions.length === 0) {
    errors.push('Cannot publish an exam without questions. Please add at least one question.');
  } else {
    // 4. Validate every question has >= 2 options and exactly 1 matching correct option
    for (const q of questions) {
      const qNum = q.number ?? `ID ${q.id}`;
      const optionKeys = extractOptionKeys(q.options);

      if (optionKeys.length < 2) {
        errors.push(`Question #${qNum} must have at least 2 options (found ${optionKeys.length}).`);
      }

      if (!q.correct_option || String(q.correct_option).trim().length === 0) {
        errors.push(`Question #${qNum} is missing a correct option.`);
      } else {
        const correctNorm = String(q.correct_option).trim().toUpperCase();
        if (!optionKeys.includes(correctNorm)) {
          errors.push(
            `Question #${qNum} correct option '${q.correct_option}' does not match any of its available options (${optionKeys.join(', ')}).`
          );
        }
      }
    }
  }

  // If validation fails, return 400 Bad Request with details
  if (errors.length > 0) {
    return jsonError('Cannot publish exam: requirements not met', 400, errors);
  }

  // 5. Publish the exam
  const { data: updatedExam, error: publishError } = await supabase
    .from('exams')
    .update({
      status: 'published',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (publishError) {
    return jsonError(publishError.message, 500);
  }

  return jsonSuccess({
    message: 'Exam published successfully',
    exam: updatedExam,
  });
}

