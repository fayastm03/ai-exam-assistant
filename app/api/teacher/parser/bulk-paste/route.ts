import { NextRequest } from 'next/server';
import { POST as parseHandler } from '@/app/api/teacher/questions/parse/route';

/**
 * POST /api/teacher/parser/bulk-paste
 * Convenience alias for POST /api/teacher/questions/parse
 */
export async function POST(request: NextRequest) {
  return parseHandler(request);
}
