import { NextRequest } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { joinClassSchema } from '@/lib/validations/student';

/**
 * POST /api/student/classes/join
 * Allows a student to join a class via a 6-character join code.
 *
 * Rules:
 * - Rate limit: 10 attempts per user per 15 minutes using join_attempts table (returns 429).
 * - Lookup code server-side via service role client (never exposed to browser).
 * - Code is normalized: trimmed and uppercased.
 * - Missing class OR join_enabled === false returns generic error: "Invalid or disabled code".
 * - If no membership exists: create row with status 'pending'.
 * - If pending or approved: return current status without error.
 * - If rejected: return status 'rejected' and do NOT create a new request.
 * - If removed: reset status back to 'pending'.
 * - Never expose join_code in the response.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  // 1. Rate Limiting Check: 10 attempts per user per 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { count: recentAttempts, error: countError } = await supabase
    .from('join_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.user.id)
    .gte('attempted_at', fifteenMinutesAgo);

  if (!countError && recentAttempts !== null && recentAttempts >= 10) {
    return jsonError('Too many join attempts. Please try again later.', 429);
  }

  // Record this join attempt in join_attempts table
  await supabase.from('join_attempts').insert({
    user_id: auth.user.id,
    attempted_at: new Date().toISOString(),
  });

  try {
    const body = await request.json();
    const parsed = joinClassSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Invalid or disabled code', 400);
    }

    // 2. Normalize join code (trim and uppercase)
    const normalizedCode = parsed.data.code.trim().toUpperCase();

    // 3. Lookup class with service role (server-side only)
    const { data: cls, error: classLookupError } = await supabase
      .from('classes')
      .select('id, name, join_enabled')
      .eq('join_code', normalizedCode)
      .maybeSingle();

    if (classLookupError || !cls || !cls.join_enabled) {
      // Must return identical generic message for missing or disabled class codes
      return jsonError('Invalid or disabled code', 400);
    }

    // 4. Check existing membership
    const { data: existingMembership, error: membershipError } = await supabase
      .from('class_members')
      .select('id, status')
      .eq('class_id', cls.id)
      .eq('student_id', auth.user.id)
      .maybeSingle();

    if (membershipError) {
      return jsonError(membershipError.message, 500);
    }

    const now = new Date().toISOString();

    // Case 4a: No membership exists -> create it as 'pending'
    if (!existingMembership) {
      const { data: newMember, error: insertError } = await supabase
        .from('class_members')
        .insert({
          class_id: cls.id,
          student_id: auth.user.id,
          status: 'pending',
          requested_at: now,
          created_at: now,
          updated_at: now,
        })
        .select('id, status, requested_at')
        .single();

      if (insertError) {
        return jsonError(insertError.message, 500);
      }

      return jsonSuccess({
        message: 'Join request submitted and pending teacher approval',
        status: newMember.status,
        class: {
          id: cls.id,
          name: cls.name,
        },
      });
    }

    // Case 4b: Already 'pending' or 'approved' -> return current status without error
    if (
      existingMembership.status === 'pending' ||
      existingMembership.status === 'approved'
    ) {
      return jsonSuccess({
        message:
          existingMembership.status === 'approved'
            ? 'You are an approved member of this class'
            : 'Your join request is already pending approval',
        status: existingMembership.status,
        class: {
          id: cls.id,
          name: cls.name,
        },
      });
    }

    // Case 4c: Membership was 'rejected' -> return that it is rejected and do not create a new request
    if (existingMembership.status === 'rejected') {
      return jsonSuccess({
        message: 'Your join request for this class was previously rejected',
        status: 'rejected',
        class: {
          id: cls.id,
          name: cls.name,
        },
      });
    }

    // Case 4d: Membership was 'removed' -> set it back to 'pending'
    if (existingMembership.status === 'removed') {
      const { data: updatedMember, error: updateError } = await supabase
        .from('class_members')
        .update({
          status: 'pending',
          requested_at: now,
          decided_at: null,
          updated_at: now,
        })
        .eq('id', existingMembership.id)
        .select('id, status')
        .single();

      if (updateError) {
        return jsonError(updateError.message, 500);
      }

      return jsonSuccess({
        message: 'Join request re-submitted and pending approval',
        status: updatedMember.status,
        class: {
          id: cls.id,
          name: cls.name,
        },
      });
    }

    return jsonSuccess({
      status: existingMembership.status,
      class: {
        id: cls.id,
        name: cls.name,
      },
    });
  } catch (err: unknown) {
    return jsonError(err instanceof Error ? err.message : 'Invalid request payload', 400);
  }
}
