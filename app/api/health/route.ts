import { NextResponse } from 'next/server';

/**
 * Health check endpoint. Returns simple ok status without leaking internal state.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
