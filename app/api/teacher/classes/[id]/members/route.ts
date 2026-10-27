import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/teacher/classes/[id]/members
 * Lists members of a class owned by the teacher, optionally filtered by ?status=pending|approved|rejected|removed.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const supabase = createServiceRoleClient();

  // Verify class ownership
  const { data: cls, error: clsError } = await supabase
    .from('classes')
    .select('id, name')
    .eq('id', id)
    .eq('teacher_id', auth.user.id)
    .single();

  if (clsError || !cls) {
    return jsonError('Class not found or access denied', 404);
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');

  let query = supabase
    .from('class_members')
    .select(`
      id,
      class_id,
      student_id,
      status,
      requested_at,
      decided_at,
      created_at,
      profiles:student_id (
        id,
        name
      )
    `)
    .eq('class_id', id)
    .order('requested_at', { ascending: false });

  if (statusParam) {
    const validStatuses = ['pending', 'approved', 'rejected', 'removed'];
    if (!validStatuses.includes(statusParam)) {
      return jsonError(
        `Invalid status filter. Allowed values: ${validStatuses.join(', ')}`,
        400
      );
    }
    query = query.eq('status', statusParam);
  }

  const { data: members, error: membersError } = await query;

  if (membersError) {
    return jsonError(membersError.message, 500);
  }

  // Fetch emails for these students via service role admin API
  const studentIds = Array.from(new Set((members || []).map((m) => m.student_id)));
  const emailMap = new Map<string, string>();
  await Promise.all(
    studentIds.map(async (sid) => {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(sid);
        if (userData?.user?.email) {
          emailMap.set(sid, userData.user.email);
        }
      } catch {
        // ignore individual lookup error
      }
    })
  );

  const formatted = (members || []).map((m) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      id: m.id,
      class_id: m.class_id,
      student_id: m.student_id,
      student_name: profile?.name || 'Unknown Student',
      student_email: emailMap.get(m.student_id) || '',
      status: m.status,
      requested_at: m.requested_at,
      decided_at: m.decided_at,
      created_at: m.created_at,
    };
  });

  return jsonSuccess({
    class: cls,
    members: formatted,
  });
}

