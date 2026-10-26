import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { examAssignClassesSchema } from '@/lib/validations/teacher';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/teacher/exams/[id]/classes
 * Returns the classes currently assigned to this exam.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;
  const supabase = createServiceRoleClient();

  // Verify exam ownership
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id')
    .eq('id', examId)
    .single();

  if (examError || !exam || exam.teacher_id !== auth.user.id) {
    return jsonError('Exam not found or access denied', 404);
  }

  // Fetch assigned classes
  const { data: assignments, error: assignError } = await supabase
    .from('exam_classes')
    .select(`
      class_id,
      classes:class_id (
        id,
        name,
        join_code,
        join_enabled,
        created_at
      )
    `)
    .eq('exam_id', examId);

  if (assignError) {
    return jsonError(assignError.message, 500);
  }

  const assignedClasses = (assignments || []).map((a) => {
    return Array.isArray(a.classes) ? a.classes[0] : a.classes;
  });

  return jsonSuccess({
    classes: assignedClasses,
    class_ids: assignedClasses.map((c) => c?.id).filter(Boolean),
  });
}

/**
 * PUT /api/teacher/exams/[id]/classes
 * Assigns an exam to classes (replaces the exam's exam_classes for the teacher's own classes only).
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const { id: examId } = await context.params;

  try {
    const body = await request.json();
    const parsed = examAssignClassesSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const requestedClassIds = Array.from(new Set(parsed.data.class_ids));
    const supabase = createServiceRoleClient();

    // Verify exam ownership
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, teacher_id')
      .eq('id', examId)
      .single();

    if (examError || !exam || exam.teacher_id !== auth.user.id) {
      return jsonError('Exam not found or access denied', 404);
    }

    // Verify that ALL provided class_ids belong to this teacher
    if (requestedClassIds.length > 0) {
      const { data: ownedClasses, error: ownedError } = await supabase
        .from('classes')
        .select('id')
        .in('id', requestedClassIds)
        .eq('teacher_id', auth.user.id);

      if (ownedError) {
        return jsonError(ownedError.message, 500);
      }

      const ownedClassIds = new Set((ownedClasses || []).map((c) => c.id));
      const unauthorizedIds = requestedClassIds.filter((cid) => !ownedClassIds.has(cid));

      if (unauthorizedIds.length > 0) {
        return jsonError(
          'Access denied: You can only assign exams to classes that you own',
          403,
          { unauthorized_classes: unauthorizedIds }
        );
      }
    }

    // Replace exam_classes: delete existing assignments and re-insert
    const { error: deleteError } = await supabase
      .from('exam_classes')
      .delete()
      .eq('exam_id', examId);

    if (deleteError) {
      return jsonError(deleteError.message, 500);
    }

    if (requestedClassIds.length > 0) {
      const rowsToInsert = requestedClassIds.map((cid) => ({
        exam_id: examId,
        class_id: cid,
      }));

      const { error: insertError } = await supabase
        .from('exam_classes')
        .insert(rowsToInsert);

      if (insertError) {
        return jsonError(insertError.message, 500);
      }
    }

    return jsonSuccess({
      message: 'Exam classes updated successfully',
      assigned_classes: requestedClassIds,
    });
  } catch (err: unknown) {
    return jsonError(err instanceof Error ? err.message : 'Invalid request payload', 400);
  }
}

export const POST = PUT;

