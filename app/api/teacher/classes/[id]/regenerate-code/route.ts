import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateUniqueJoinCode } from '@/lib/classes';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/teacher/classes/[id]/regenerate-code
 * Generates a new unique 6-character join code for a class owned by the authenticated teacher.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const supabase = createServiceRoleClient();

  // Verify ownership
  const { data: existingClass, error: findError } = await supabase
    .from('classes')
    .select('id, name')
    .eq('id', id)
    .eq('teacher_id', auth.user.id)
    .single();

  if (findError || !existingClass) {
    return jsonError('Class not found or you do not have permission to modify it', 404);
  }

  // Generate new unique join code
  const newCode = await generateUniqueJoinCode(supabase);

  const { data: updatedClass, error: updateError } = await supabase
    .from('classes')
    .update({
      join_code: newCode,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  return jsonSuccess({
    class: updatedClass,
    message: 'Join code regenerated successfully',
  });
}
