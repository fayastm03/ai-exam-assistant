import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { classUpdateSchema } from '@/lib/validations/teacher';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/teacher/classes/[id]
 * Fetches a single class owned by the authenticated teacher.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const supabase = createServiceRoleClient();

  const { data: cls, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', id)
    .eq('teacher_id', auth.user.id)
    .single();

  if (error || !cls) {
    return jsonError('Class not found or access denied', 404);
  }

  return jsonSuccess({ class: cls });
}

/**
 * PATCH /api/teacher/classes/[id]
 * Updates class name and/or join_enabled for a class owned by the authenticated teacher.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = classUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const supabase = createServiceRoleClient();

    // Verify ownership
    const { data: existingClass, error: findError } = await supabase
      .from('classes')
      .select('id')
      .eq('id', id)
      .eq('teacher_id', auth.user.id)
      .single();

    if (findError || !existingClass) {
      return jsonError('Class not found or you do not have permission to edit it', 404);
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.name !== undefined) {
      updates.name = parsed.data.name;
    }
    if (parsed.data.join_enabled !== undefined) {
      updates.join_enabled = parsed.data.join_enabled;
    }

    const { data: updatedClass, error: updateError } = await supabase
      .from('classes')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      return jsonError(updateError.message, 500);
    }

    return jsonSuccess({
      class: updatedClass,
      message: 'Class updated successfully',
    });
  } catch (err: unknown) {
    return jsonError(err instanceof Error ? err.message : 'Invalid request payload', 400);
  }
}
