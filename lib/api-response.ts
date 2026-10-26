import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function jsonSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number = 400, details?: unknown) {
  return NextResponse.json(
    {
      error: status >= 500 ? 'Internal Server Error' : 'Bad Request',
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

