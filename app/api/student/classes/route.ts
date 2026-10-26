import { NextRequest } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/student/classes
 * Lists the authenticated student's classes with their membership status in each
 * (pending, approved, rejected, removed).
 *
 * Security:
 * - Never exposes a class's join_code to students.
 * - Never exposes other students or member rosters.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  // Fetch student's class memberships and join with class metadata
  const { data: memberships, error } = await supabase
    .from('class_members')
    .select(`
      id,
      class_id,
      status,
      requested_at,
      decided_at,
      classes:class_id (
        id,
        name,
        created_at,
        profiles:teacher_id (
          id,
          name
        )
      )
    `)
    .eq('student_id', auth.user.id)
    .order('requested_at', { ascending: false });

  if (error) {
    return jsonError(error.message, 500);
  }

  const formatted = (memberships || []).map((m) => {
    const cls = Array.isArray(m.classes) ? m.classes[0] : m.classes;
    const teacherProfile = cls && 'profiles' in cls
      ? (Array.isArray(cls.profiles) ? cls.profiles[0] : cls.profiles)
      : null;

    return {
      membership_id: m.id,
      class_id: m.class_id,
      class_name: cls?.name || 'Class',
      teacher_name: teacherProfile?.name || 'Instructor',
      status: m.status,
      requested_at: m.requested_at,
      decided_at: m.decided_at,
      created_at: cls?.created_at,
    };
  });

  return jsonSuccess({ classes: formatted });
}
