import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { classCreateSchema } from '@/lib/validations/teacher';
import { generateUniqueJoinCode } from '@/lib/classes';

/**
 * POST /api/teacher/classes
 * Creates a new class owned by the authenticated teacher with a generated unique join code.
 */
export async function POST(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const parsed = classCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const supabase = createServiceRoleClient();
    const joinCode = await generateUniqueJoinCode(supabase);

    const { data: newClass, error: insertError } = await supabase
      .from('classes')
      .insert({
        teacher_id: auth.user.id,
        name: parsed.data.name,
        join_code: joinCode,
        join_enabled: true,
      })
      .select('*')
      .single();

    if (insertError) {
      return jsonError(insertError.message, 500);
    }

    return jsonSuccess(
      {
        class: newClass,
        message: 'Class created successfully',
      },
      201
    );
  } catch (err: unknown) {
    return jsonError(err instanceof Error ? err.message : 'Invalid request payload', 400);
  }
}

/**
 * GET /api/teacher/classes
 * Lists all classes owned by the authenticated teacher with counts of approved and pending members.
 */
export async function GET(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  // 1. Fetch teacher's classes
  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', auth.user.id)
    .order('created_at', { ascending: false });

  if (classesError) {
    return jsonError(classesError.message, 500);
  }

  if (!classes || classes.length === 0) {
    return jsonSuccess({ classes: [] });
  }

  const classIds = classes.map((c) => c.id);

  // 2. Fetch membership counts for approved and pending statuses
  const { data: memberRows, error: memberError } = await supabase
    .from('class_members')
    .select('class_id, status')
    .in('class_id', classIds)
    .in('status', ['approved', 'pending']);

  if (memberError) {
    return jsonError(memberError.message, 500);
  }

  const countsByClass: Record<string, { approved: number; pending: number }> = {};
  classIds.forEach((id) => {
    countsByClass[id] = { approved: 0, pending: 0 };
  });

  (memberRows || []).forEach((row) => {
    if (countsByClass[row.class_id]) {
      if (row.status === 'approved') countsByClass[row.class_id].approved++;
      if (row.status === 'pending') countsByClass[row.class_id].pending++;
    }
  });

  const formatted = classes.map((cls) => ({
    ...cls,
    approved_count: countsByClass[cls.id]?.approved ?? 0,
    pending_count: countsByClass[cls.id]?.pending ?? 0,
  }));

  return jsonSuccess({ classes: formatted });
}
