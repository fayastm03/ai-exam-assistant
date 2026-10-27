import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { generateReferenceId } from './messages';

export function jsonSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number = 400, details?: unknown) {
  if (status >= 500) {
    const referenceId = generateReferenceId();
    // Log technical detail strictly on the server
    console.error(`[Server Error Ref: ${referenceId}]`, message, details ?? '');

    const lower = message.toLowerCase();
    const isLeaky =
      lower.includes('postgres') ||
      lower.includes('supabase') ||
      lower.includes('column') ||
      lower.includes('relation') ||
      lower.includes('foreign key') ||
      lower.includes('sql') ||
      lower.includes('violates');

    const cleanMessage = isLeaky
      ? `An unexpected problem occurred (reference: ${referenceId}). Our team has logged the details. Please try again shortly.`
      : message;

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: cleanMessage,
        referenceId,
      },
      { status }
    );
  }

  return NextResponse.json(
    {
      error: status === 404 ? 'Not Found' : status === 403 ? 'Forbidden' : 'Bad Request',
      message,
      ...(details !== undefined ? { details } : {}),
    },
    { status }
  );
}

export function handleZodError(err: ZodError) {
  const issues = err.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

  return NextResponse.json(
    {
      error: 'Validation Error',
      message: 'Invalid request data',
      details: issues,
    },
    { status: 400 }
  );
}
