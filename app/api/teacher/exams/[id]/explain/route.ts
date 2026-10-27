import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { explainExamQuestions } from '@/lib/ai/explainer';

export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ id: string }>;
}

function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  const status = typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status: unknown }).status) : 0;
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('too many requests')
  );
}

/**
 * POST /api/teacher/exams/[id]/explain
 * Generates explanations for all questions in an exam in one call using prompts/v1/explain.txt.
 * Saves each explanation as a draft with review_status 'draft'.
 * Preserves correct_option strictly — AI NEVER modifies correct_option.
 * Flags questions with issues prominently with the AI's reason.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  // 1. Verify exam exists and belongs to the teacher
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id, title')
    .eq('id', examId)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found', 404);
  }

  if (exam.teacher_id !== auth.user.id) {
    return jsonError('Access denied: You can only generate explanations for your own exams', 403);
  }

  // 2. Fetch all questions for this exam
  const { data: questions, error: qError } = await supabase
    .from('questions')
    .select('id, number, text, options, correct_option, topic, explanation')
    .eq('exam_id', examId)
    .order('number', { ascending: true });

  if (qError) {
    return jsonError('Failed to fetch exam questions: ' + qError.message, 500);
  }

  if (!questions || questions.length === 0) {
    return jsonError('Exam has no questions to explain. Please add questions first.', 400);
  }

  // 3. Call AI provider for whole exam in one batch call
  try {
    const aiResult = await explainExamQuestions(questions);

    if (aiResult.isFlagged || !aiResult.data) {
      return jsonError(
        aiResult.flagReason || 'AI explanation service failed to produce valid responses. Please try again.',
        502
      );
    }

    const { questions: explainedList } = aiResult.data;
    const dbQuestionsByNumber = new Map(questions.map((q) => [q.number, q]));

    let updatedCount = 0;
    const flaggedQuestions: { number: number; reason: string }[] = [];

    // 4. Update each question's explanation in database as draft
    // STRICT RULE: correct_option is NEVER changed by the AI!
    for (const expItem of explainedList) {
      const dbQ = dbQuestionsByNumber.get(expItem.number);
      if (!dbQ) continue;

      let explanationText = expItem.explanation.trim();
      if (expItem.flag && expItem.flag_reason) {
        const cleanReason = expItem.flag_reason.trim();
        flaggedQuestions.push({ number: expItem.number, reason: cleanReason });
        explanationText = `[AI Flag: ${cleanReason}]\n\n${explanationText}`;
      }

      const { error: updateError } = await supabase
        .from('questions')
        .update({
          explanation: explanationText,
          review_status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbQ.id);

      if (!updateError) {
        updatedCount++;
      }
    }

    return jsonSuccess({
      message: `Successfully generated explanations for ${updatedCount} question(s) as drafts.`,
      updatedCount,
      flaggedCount: flaggedQuestions.length,
      flaggedQuestions,
    });
  } catch (err: unknown) {
    if (isRateLimitError(err)) {
      return jsonError('AI service is currently rate limited. Please wait a moment and try again.', 429);
    }
    const message = err instanceof Error ? err.message : 'Unknown AI error';
    return jsonError('Error while generating explanations: ' + message, 500);
  }
}

