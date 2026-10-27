import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess, handleZodError } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateQuestionsFromNotes } from '@/lib/ai/generator';
import { generateFromNotesInputSchema } from '@/lib/validations/ai';

export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB safe limit (Vercel payload maximum is 4.5MB)

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);

function isAllowedFile(file: File): boolean {
  if (ALLOWED_MIME_TYPES.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.pdf') ||
    name.endsWith('.docx') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg')
  );
}

function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status: unknown }).status)
      : 0;
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
 * POST /api/teacher/exams/[id]/generate
 * Generates MCQs from pasted notes or uploaded document/photo using prompts/v1/generate.txt.
 * Saves created questions with source: 'generated' and review_status: 'draft'.
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
    return jsonError('Access denied: You can only generate questions for your own exams', 403);
  }

  // 2. Parse request payload (supports multipart/form-data or application/json)
  const contentType = request.headers.get('content-type') || '';
  let count = 5;
  let level: 'easy' | 'medium' | 'hard' = 'medium';
  let text = '';
  let fileData: { buffer: Buffer; mimeType: string; name: string } | undefined;

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const countRaw = formData.get('count');
      const levelRaw = formData.get('level');
      const textRaw = formData.get('text');
      const file = formData.get('file');

      const parsedInput = generateFromNotesInputSchema.safeParse({
        count: countRaw ? Number(countRaw) : 5,
        level: levelRaw || 'medium',
        text: typeof textRaw === 'string' ? textRaw : '',
      });

      if (!parsedInput.success) {
        return handleZodError(parsedInput.error);
      }

      count = parsedInput.data.count;
      level = parsedInput.data.level;
      text = parsedInput.data.text;

      if (file && file instanceof File && file.size > 0) {
        if (!isAllowedFile(file)) {
          return jsonError('Unsupported file type. Please upload a PDF, DOCX, PNG, or JPG file.', 400);
        }
        if (file.size > MAX_FILE_SIZE) {
          return jsonError('File size exceeds the 4MB limit (Vercel serverless request body limit is 4.5MB).', 413);
        }

        const arrayBuffer = await file.arrayBuffer();
        fileData = {
          buffer: Buffer.from(arrayBuffer),
          mimeType: file.type || 'application/octet-stream',
          name: file.name,
        };
      }
    } else {
      const body = await request.json();
      const parsedInput = generateFromNotesInputSchema.safeParse(body);
      if (!parsedInput.success) {
        return handleZodError(parsedInput.error);
      }

      count = parsedInput.data.count;
      level = parsedInput.data.level;
      text = parsedInput.data.text;
    }
  } catch (err: unknown) {
    return jsonError('Failed to parse request payload: ' + (err instanceof Error ? err.message : 'Invalid request'), 400);
  }

  // 3. Ensure some material is provided
  if (!fileData && (!text || text.trim().length === 0)) {
    return jsonError('Please provide notes text or upload a document/photo to generate questions from', 400);
  }

  // 4. Generate questions via AI
  try {
    const aiResult = await generateQuestionsFromNotes({
      count,
      level,
      text,
      file: fileData,
    });

    if (aiResult.isFlagged || !aiResult.data) {
      return jsonError(
        aiResult.flagReason || 'AI failed to generate valid questions from the provided notes.',
        502
      );
    }

    const generatedList = aiResult.data.questions;
    if (generatedList.length === 0) {
      return jsonError('No questions could be generated from the provided material.', 400);
    }

    // 5. Query highest existing question number in this exam
    const { data: existingQuestions } = await supabase
      .from('questions')
      .select('number')
      .eq('exam_id', examId)
      .order('number', { ascending: false })
      .limit(1);

    const baseNumber = existingQuestions && existingQuestions[0] ? existingQuestions[0].number : 0;

    // 6. Insert generated questions as drafts with source = 'generated'
    const questionsToInsert = generatedList.map((q, idx) => ({
      exam_id: examId,
      number: baseNumber + idx + 1,
      text: q.text,
      options: q.options,
      correct_option: q.correct_option.trim().toUpperCase(),
      marks: q.marks || 1,
      topic: q.topic || null,
      explanation: q.explanation || null,
      source: 'generated' as const,
      review_status: 'draft' as const,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('questions')
      .insert(questionsToInsert)
      .select('id, number, text, options, correct_option, marks, topic, explanation, source, review_status');

    if (insertError) {
      return jsonError('Failed to save generated questions: ' + insertError.message, 500);
    }

    return jsonSuccess({
      message: `Successfully generated ${inserted?.length || questionsToInsert.length} question(s) as drafts.`,
      questions: inserted || questionsToInsert,
      count: inserted?.length || questionsToInsert.length,
    });
  } catch (err: unknown) {
    if (isRateLimitError(err)) {
      return jsonError('AI service is currently rate limited. Please wait a moment and try again.', 429);
    }
    const message = err instanceof Error ? err.message : 'Unknown AI error';
    return jsonError('Error while generating questions: ' + message, 500);
  }
}
