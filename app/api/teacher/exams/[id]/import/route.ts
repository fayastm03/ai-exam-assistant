import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { extractQuestionsFromFile } from '@/lib/ai/paper-extractor';
import { ExtractedQuestion } from '@/lib/validations/ai';

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

/**
 * POST /api/teacher/exams/[id]/import
 * Uploads a PDF, DOCX, or photo, extracts MCQ questions via AI,
 * validates against Zod schema, and saves questions as draft with source 'imported'.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  // 1. Verify exam exists and belongs to the teacher
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id, title, status')
    .eq('id', examId)
    .single();

  if (examError || !exam) {
    return jsonError('Exam not found', 404);
  }

  if (exam.teacher_id !== auth.user.id) {
    return jsonError('Access denied: You can only import papers into your own exams', 403);
  }

  // 2. Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Invalid multipart form data', 400);
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return jsonError('Please upload a file to import (PDF, DOCX, PNG, or JPG)', 400);
  }

  // 3. Validate file size and type
  if (file.size > MAX_FILE_SIZE) {
    return jsonError('File size exceeds the 4MB limit (Vercel serverless request body limit is 4.5MB)', 413);
  }

  if (!isAllowedFile(file)) {
    return jsonError('Invalid file type. Accepted formats are PDF, DOCX, PNG, and JPG', 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let extractedQuestions: ExtractedQuestion[] = [];
  let rawTextOutput = '';

  try {
    const result = await extractQuestionsFromFile({
      buffer,
      mimeType: file.type,
      name: file.name,
    });

    rawTextOutput = result.rawText;
    if (result.isFlagged || !result.data?.questions || result.data.questions.length === 0) {
      return jsonError(
        `Failed to extract questions: ${result.flagReason || 'No MCQ questions found in paper'}`,
        422,
        { rawOutput: result.rawText }
      );
    }

    extractedQuestions = result.data.questions;
  } catch (aiErr: unknown) {
    return jsonError(
      aiErr instanceof Error ? aiErr.message : 'Error communicating with AI service',
      500
    );
  }

  // 4. Determine starting question number
  const { data: existingQuestions } = await supabase
    .from('questions')
    .select('number')
    .eq('exam_id', exam.id)
    .order('number', { ascending: false })
    .limit(1);

  const startNumber =
    existingQuestions && existingQuestions.length > 0 ? existingQuestions[0].number + 1 : 1;

  // 5. Save extracted questions as draft with source 'imported'
  const questionsToInsert = extractedQuestions.map((q, index) => {
    // If correct option is missing, store UNSET so it satisfies NOT NULL in database
    const correctOpt = q.correct_option && q.correct_option.trim().length > 0
      ? q.correct_option.trim().toUpperCase()
      : 'UNSET';

    return {
      exam_id: exam.id,
      number: startNumber + index,
      text: q.text,
      options: q.options,
      correct_option: correctOpt,
      marks: q.marks || 1,
      topic: q.topic || null,
      explanation: q.explanation || null,
      source: 'imported' as const,
      review_status: 'draft' as const,
    };
  });

  const { data: insertedQuestions, error: insertError } = await supabase
    .from('questions')
    .insert(questionsToInsert)
    .select('*')
    .order('number', { ascending: true });

  if (insertError) {
    return jsonError(`Failed to save extracted questions: ${insertError.message}`, 500);
  }

  // Generate base64 data URL for client-side preview
  const dataUrl = `data:${file.type || 'application/octet-stream'};base64,${buffer.toString('base64')}`;

  return jsonSuccess({
    ok: true,
    message: `Successfully extracted and saved ${insertedQuestions.length} draft question(s)`,
    questions: insertedQuestions,
    fileInfo: {
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl,
    },
    rawOutput: rawTextOutput,
  });
}
