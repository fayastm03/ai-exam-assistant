import { NextRequest } from 'next/server';
import { requireStudent } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/student/exams
 * Lists all published exams assigned to classes where the authenticated student is APPROVED.
 * Includes class_name and marks each exam as upcoming, available, closed, or completed.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  // 1. Fetch classes where this student is APPROVED
  const { data: approvedMemberships, error: memError } = await supabase
    .from('class_members')
    .select(`
      class_id,
      classes:class_id (
        id,
        name
      )
    `)
    .eq('student_id', auth.user.id)
    .eq('status', 'approved');

  if (memError) {
    return jsonError(memError.message, 500);
  }

  // If the student is not approved in any class, they see 0 exams
  if (!approvedMemberships || approvedMemberships.length === 0) {
    return jsonSuccess({ exams: [] });
  }

  const approvedClassIds = approvedMemberships.map((m) => m.class_id);
  const classNameById = new Map<string, string>();
  approvedMemberships.forEach((m) => {
    const cls = Array.isArray(m.classes) ? m.classes[0] : m.classes;
    if (cls?.name) {
      classNameById.set(m.class_id, cls.name);
    }
  });

  // 2. Fetch exam assignments for these approved classes
  const { data: examClassRows, error: ecError } = await supabase
    .from('exam_classes')
    .select('exam_id, class_id')
    .in('class_id', approvedClassIds);

  if (ecError) {
    return jsonError(ecError.message, 500);
  }

  if (!examClassRows || examClassRows.length === 0) {
    return jsonSuccess({ exams: [] });
  }

  const examIds = Array.from(new Set(examClassRows.map((r) => r.exam_id)));
  const examToClassNames = new Map<string, string[]>();
  examClassRows.forEach((r) => {
    const cName = classNameById.get(r.class_id);
    if (cName) {
      const existing = examToClassNames.get(r.exam_id) || [];
      if (!existing.includes(cName)) {
        existing.push(cName);
      }
      examToClassNames.set(r.exam_id, existing);
    }
  });

  // 3. Fetch published exams
  const { data: exams, error: examsError } = await supabase
    .from('exams')
    .select(`
      id,
      title,
      instructions,
      duration_min,
      open_at,
      close_at,
      negative_marking,
      shuffle,
      status,
      created_at,
      questions (count)
    `)
    .in('id', examIds)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (examsError) {
    return jsonError(examsError.message, 500);
  }

  // 4. Fetch current student's attempts across these exams
  const { data: myAttempts } = await supabase
    .from('attempts')
    .select('id, exam_id, started_at, deadline_at, submitted_at, status, score')
    .eq('student_id', auth.user.id)
    .in('exam_id', examIds);

  const attemptByExam = new Map<string, { status?: string }>();
  (myAttempts || []).forEach((att) => {
    attemptByExam.set(att.exam_id, att);
  });

  const now = new Date();

  // 5. Format results with class name and upcoming / available / closed / completed status
  const formatted = (exams || []).map((exam) => {
    const questionsCount = Array.isArray(exam.questions)
      ? (exam.questions[0] as { count?: number })?.count ?? 0
      : 0;

    const examCopy = { ...exam } as Record<string, unknown>;
    delete examCopy.questions;

    const attempt = attemptByExam.get(exam.id);
    const isCompleted =
      attempt?.status === 'submitted' || attempt?.status === 'auto_submitted';

    let timingStatus: 'upcoming' | 'available' | 'closed' | 'completed';
    if (isCompleted) {
      timingStatus = 'completed';
    } else if (exam.open_at && now < new Date(exam.open_at)) {
      timingStatus = 'upcoming';
    } else if (exam.close_at && now > new Date(exam.close_at)) {
      timingStatus = 'closed';
    } else {
      timingStatus = 'available';
    }

    const classNames = examToClassNames.get(exam.id) || [];
    const className = classNames.join(', ');

    return {
      ...examCopy,
      class_name: className,
      class_names: classNames,
      timing_status: timingStatus,
      question_count: questionsCount,
      my_attempt: attempt || null,
    };
  });

  return jsonSuccess({ exams: formatted });
}
