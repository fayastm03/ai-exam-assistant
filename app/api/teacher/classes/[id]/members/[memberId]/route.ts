import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { classMemberUpdateSchema } from '@/lib/validations/teacher';

interface RouteContext {
  params: Promise<{ id: string; memberId: string }>;
}

/**
 * PATCH /api/teacher/classes/[id]/members/[memberId]
 * Updates member status (approved, rejected, removed) and sets decided_at.
 * Restricted to the owning teacher of the class.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id: classId, memberId } = await context.params;

  try {
    const body = await request.json();
    const parsed = classMemberUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const supabase = createServiceRoleClient();

    // Verify class ownership
    const { data: cls, error: clsError } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('teacher_id', auth.user.id)
      .single();

    if (clsError || !cls) {
      return jsonError('Class not found or access denied', 404);
    }

    // Verify member exists in this class
    const { data: existingMember, error: memberFindError } = await supabase
      .from('class_members')
      .select('id, status')
      .eq('id', memberId)
      .eq('class_id', classId)
      .single();

    if (memberFindError || !existingMember) {
      return jsonError('Class member record not found', 404);
    }

    const now = new Date().toISOString();
    const { data: updatedMember, error: updateError } = await supabase
      .from('class_members')
      .update({
        status: parsed.data.status,
        decided_at: now,
        updated_at: now,
      })
      .eq('id', memberId)
      .eq('class_id', classId)
      .select('*')
      .single();

    if (updateError) {
      return jsonError(updateError.message, 500);
    }

    return jsonSuccess({
      member: updatedMember,
      message: `Member status successfully updated to ${parsed.data.status}`,
    });
  } catch (err: unknown) {
    return jsonError(err instanceof Error ? err.message : 'Invalid request payload', 400);
  }
}
