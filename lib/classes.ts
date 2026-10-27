/**
 * Pure business logic and helper functions for Class management,
 * Join code normalisation, membership state transitions, and exam timing status.
 */

export type MembershipStatus = 'pending' | 'approved' | 'rejected' | 'removed';

export type ExamTimingStatus = 'upcoming' | 'available' | 'closed' | 'completed';

/**
 * 32-character alphabet without look-alike / visually ambiguous characters (excludes 0, O, 1, I).
 */
export const JOIN_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a random 6-character class join code using JOIN_CODE_ALPHABET.
 */
export function generateRandomJoinCode(): string {
  let result = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * JOIN_CODE_ALPHABET.length);
    result += JOIN_CODE_ALPHABET[idx];
  }
  return result;
}

/**
 * Generates a unique 6-character join code verified against the database.
 */
export async function generateUniqueJoinCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase?: any
): Promise<string> {
  let attempts = 0;
  while (attempts < 20) {
    const code = generateRandomJoinCode();
    if (!supabase) return code;

    const { data } = await supabase
      .from('classes')
      .select('id')
      .eq('join_code', code)
      .maybeSingle();

    if (!data) {
      return code;
    }
    attempts++;
  }
  return generateRandomJoinCode();
}

export interface JoinStatusResolution {
  nextStatus: 'pending' | 'approved' | 'rejected';
  action: 'insert' | 'update' | 'noop' | 'rejected';
  message: string;
}

/**
 * Normalises a class join code:
 * - Trims whitespace from both ends
 * - Converts all characters to uppercase
 * - Strips any non-alphanumeric characters
 * - Safely handles null, undefined, or empty strings
 */
export function normalizeJoinCode(rawCode?: string | null): string {
  if (!rawCode) return '';
  return rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Evaluates the next membership state and user-facing message
 * based on the student's existing membership in a class.
 *
 * Rules:
 * - No existing membership (null/undefined) -> insert as 'pending'
 * - Already 'pending' -> no-op, returns 'pending'
 * - Already 'approved' -> no-op, returns 'approved'
 * - 'rejected' -> do not create a new request, returns 'rejected'
 * - 'removed' -> reset status back to 'pending'
 */
export function resolveJoinStatus(
  existingStatus?: MembershipStatus | null
): JoinStatusResolution {
  if (!existingStatus) {
    return {
      nextStatus: 'pending',
      action: 'insert',
      message: 'Join request submitted and pending teacher approval',
    };
  }

  switch (existingStatus) {
    case 'approved':
      return {
        nextStatus: 'approved',
        action: 'noop',
        message: 'You are an approved member of this class',
      };

    case 'pending':
      return {
        nextStatus: 'pending',
        action: 'noop',
        message: 'Your join request is already pending approval',
      };

    case 'rejected':
      return {
        nextStatus: 'rejected',
        action: 'rejected',
        message: 'Your join request for this class was previously rejected',
      };

    case 'removed':
      return {
        nextStatus: 'pending',
        action: 'update',
        message: 'Join request re-submitted and pending approval',
      };

    default:
      return {
        nextStatus: 'pending',
        action: 'insert',
        message: 'Join request submitted and pending teacher approval',
      };
  }
}

/**
 * Determines the timing status of an exam for a student:
 * - 'completed': Student already submitted or auto-submitted an attempt
 * - 'upcoming': Exam has an open_at scheduled in the future
 * - 'closed': Exam has a close_at in the past
 * - 'available': Currently open and ready to take
 */
export function computeExamTimingStatus(params: {
  open_at?: string | Date | null;
  close_at?: string | Date | null;
  attemptStatus?: string | null;
  now?: Date;
}): ExamTimingStatus {
  const { open_at, close_at, attemptStatus } = params;
  const now = params.now ?? new Date();

  const isCompleted =
    attemptStatus === 'submitted' || attemptStatus === 'auto_submitted';

  if (isCompleted) {
    return 'completed';
  }

  if (open_at) {
    const openDate = typeof open_at === 'string' ? new Date(open_at) : open_at;
    if (now < openDate) {
      return 'upcoming';
    }
  }

  if (close_at) {
    const closeDate = typeof close_at === 'string' ? new Date(close_at) : close_at;
    if (now > closeDate) {
      return 'closed';
    }
  }

  return 'available';
}
