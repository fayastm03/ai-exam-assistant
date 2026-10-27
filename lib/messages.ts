/**
 * lib/messages.ts
 * Centralized repository for all user-facing messages across the application.
 *
 * Rules:
 * - Say what happened in plain words.
 * - Say what the user can do next.
 * - Never show raw codes, status numbers, database errors, stack traces, or technical phrases.
 * - Keep technical details in server logs only.
 * - Calm, human tone: no blame, no jokes, no exclamation marks, no "Oops".
 */

export type MessageType = 'error' | 'warning' | 'info' | 'success';

export interface UserMessage {
  type: MessageType;
  title?: string;
  message: string;
  actionLabel?: string;
  actionKey?: string;
  referenceId?: string;
}

export const MESSAGES = {
  // Authentication & Account
  auth: {
    invalidCredentials: {
      type: 'error' as const,
      message:
        "That email and password don't match. Check them and try again, or reset your password.",
    },
    emailNotConfirmed: {
      type: 'warning' as const,
      message:
        'Please confirm your email address before signing in. Check your inbox for the confirmation link.',
      actionLabel: 'Resend confirmation email',
      actionKey: 'resend_confirmation',
    },
    emailRateLimit: {
      type: 'warning' as const,
      message:
        'Too many sign-up emails were sent. Please wait a few minutes and try again.',
    },
    linkExpiredOrUsed: {
      type: 'error' as const,
      message:
        'This link has expired or has already been used. Please request a new one.',
      actionLabel: 'Request new link',
      actionKey: 'request_new_link',
    },
    passwordWeak: {
      type: 'error' as const,
      message:
        'Your password must be at least 8 characters long and contain a mix of letters and numbers.',
    },
    emailAlreadyRegistered: {
      type: 'error' as const,
      message:
        'An account with this email address already exists. Try signing in instead, or reset your password.',
    },
    authRequired: {
      type: 'info' as const,
      message: 'Please sign in to continue.',
    },
    sessionExpired: {
      type: 'info' as const,
      message:
        'Your session has ended. Your answers have been saved. Please sign in again to continue your exam.',
    },
    teacherRequired: {
      type: 'error' as const,
      message:
        "You don't have permission to access the teacher dashboard. Return to the student portal.",
    },
    studentRequired: {
      type: 'error' as const,
      message:
        "You don't have permission to access the student portal with a teacher account. Return to the teacher dashboard.",
    },
  },

  // Class & Join Code
  classes: {
    invalidCode: {
      type: 'error' as const,
      message: "That code didn't work. Check it with your teacher.",
    },
    rateLimited: {
      type: 'warning' as const,
      message:
        'Too many class join attempts. Please wait a few minutes before trying another code.',
    },
    requestPending: {
      type: 'info' as const,
      message:
        'Your request to join this class is waiting for teacher approval.',
    },
    alreadyMember: {
      type: 'info' as const,
      message: 'You are already an enrolled member of this class.',
    },
    requestDeclined: {
      type: 'warning' as const,
      message:
        'Your request to join this class was declined. Speak with your teacher if this was unexpected.',
    },
    membershipRemoved: {
      type: 'warning' as const,
      message:
        'You are no longer a member of this class. Speak with your teacher if you need access again.',
    },
    requestSent: {
      type: 'success' as const,
      message:
        'Request sent. Waiting for your teacher to approve your enrollment.',
    },
  },

  // Exam & Attempts
  exams: {
    notOpenYet: {
      type: 'info' as const,
      message:
        'This exam has not started yet. Please check the scheduled start time.',
    },
    alreadyClosed: {
      type: 'warning' as const,
      message:
        'This exam is now closed. Submissions are no longer being accepted.',
    },
    alreadySubmitted: {
      type: 'info' as const,
      message:
        'You have already submitted this exam. Your responses have been recorded.',
    },
    timeExpired: {
      type: 'warning' as const,
      message:
        'Time has ended. All your saved answers have been submitted automatically.',
    },
    noPermission: {
      type: 'error' as const,
      message:
        "You don't have permission to view this exam. Return to your dashboard.",
    },
    notFound: {
      type: 'error' as const,
      message:
        'The requested exam could not be found. Check the link or return to your dashboard.',
    },
  },

  // Files & AI Operations
  uploadsAndAi: {
    fileTooLarge: {
      type: 'error' as const,
      message: 'The selected file is too large. Upload files under 10MB.',
    },
    wrongFileType: {
      type: 'error' as const,
      message:
        'This file type is not supported. Please upload a PDF, DOCX, or TXT document.',
    },
    aiBusy: {
      type: 'warning' as const,
      message:
        'The AI service is temporarily busy. Your exam and marking are not affected. Please try again in a minute.',
    },
  },

  // Network & System
  system: {
    offline: {
      type: 'warning' as const,
      message:
        'Connection issue detected. Your answers remain saved on screen and will sync as soon as you reconnect.',
    },
    unexpected: (refId: string): UserMessage => ({
      type: 'error',
      message: `An unexpected problem occurred (reference: ${refId}). Our team has logged the details. Please try again shortly.`,
      referenceId: refId,
    }),
    notFoundGeneric: {
      type: 'error' as const,
      message:
        'The page or resource you are looking for could not be found. Check the link or return home.',
    },
    forbiddenGeneric: {
      type: 'error' as const,
      message:
        "You don't have permission to view this page. Return to your dashboard.",
    },
  },

  // Success notifications
  success: {
    saved: 'Changes saved successfully.',
    released: 'Feedback released to student.',
    approved: 'Class membership approved.',
    declined: 'Class membership request declined.',
    removed: 'Member removed from class.',
    codeRegenerated: 'New class join code generated.',
    questionDuplicated: 'Question duplicated successfully.',
    questionDeleted: 'Question removed from exam.',
    examDeleted: 'Exam deleted successfully.',
    registered:
      'Account created. Please check your email to confirm your account before signing in.',
    passwordResetSent:
      'Password reset email sent. Check your inbox for instructions.',
    passwordUpdated:
      'Password updated successfully. Please sign in with your new password.',
  },
};

/**
 * Generate a short 6-8 character user-friendly reference identifier.
 */
export function generateReferenceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Map Supabase auth errors or exceptions to friendly user-facing messages.
 */
export function mapAuthError(error: unknown): UserMessage {
  if (!error) {
    return MESSAGES.system.unexpected(generateReferenceId());
  }

  const raw =
    typeof error === 'string'
      ? error
      : (error as { message?: string }).message || '';
  const lower = raw.toLowerCase();

  // Wrong email or password
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid credentials') ||
    lower.includes('wrong password') ||
    lower.includes('email and password')
  ) {
    return MESSAGES.auth.invalidCredentials;
  }

  // Email not confirmed
  if (
    lower.includes('email not confirmed') ||
    lower.includes('not confirmed') ||
    lower.includes('unconfirmed')
  ) {
    return MESSAGES.auth.emailNotConfirmed;
  }

  // Email rate limit
  if (
    lower.includes('rate limit') ||
    lower.includes('too many') ||
    lower.includes('email rate limit exceeded')
  ) {
    return MESSAGES.auth.emailRateLimit;
  }

  // Token expired / used
  if (
    lower.includes('token has expired') ||
    lower.includes('token has expired or is invalid') ||
    lower.includes('otp expired') ||
    lower.includes('invalid token') ||
    lower.includes('confirmation_failed')
  ) {
    return MESSAGES.auth.linkExpiredOrUsed;
  }

  // Email already registered
  if (
    lower.includes('already registered') ||
    lower.includes('already exists') ||
    lower.includes('user already exists')
  ) {
    return MESSAGES.auth.emailAlreadyRegistered;
  }

  // Password too short or weak
  if (
    lower.includes('password') &&
    (lower.includes('short') ||
      lower.includes('weak') ||
      lower.includes('at least'))
  ) {
    return MESSAGES.auth.passwordWeak;
  }

  // Fallback: log raw detail and return safe unexpected error with reference ID
  const refId = generateReferenceId();
  if (typeof console !== 'undefined') {
    console.error(`[Auth Error Ref: ${refId}]`, error);
  }
  return MESSAGES.system.unexpected(refId);
}

/**
 * Map URL search parameter error codes (e.g. ?error=auth_required).
 */
export function mapUrlAuthParam(code: string | null): UserMessage | null {
  if (!code) return null;

  switch (code) {
    case 'auth_required':
      return MESSAGES.auth.authRequired;
    case 'session_expired':
      return MESSAGES.auth.sessionExpired;
    case 'teacher_required':
      return MESSAGES.auth.teacherRequired;
    case 'student_required':
      return MESSAGES.auth.studentRequired;
    case 'email_not_confirmed':
      return MESSAGES.auth.emailNotConfirmed;
    case 'confirmation_failed':
      return MESSAGES.auth.linkExpiredOrUsed;
    default:
      return null;
  }
}

/**
 * Map API response error payloads or exceptions to a calm UserMessage.
 */
export function mapApiError(error: unknown, fallbackMessage?: string): UserMessage {
  if (typeof error === 'string') {
    return mapErrorMessageString(error, fallbackMessage);
  }

  if (error && typeof error === 'object') {
    const errObj = error as {
      message?: string;
      error?: string;
      referenceId?: string;
      status?: number;
    };

    if (errObj.referenceId) {
      return MESSAGES.system.unexpected(errObj.referenceId);
    }

    if (errObj.status === 429) {
      return MESSAGES.classes.rateLimited;
    }

    if (errObj.status === 403) {
      return MESSAGES.system.forbiddenGeneric;
    }

    if (errObj.status === 404) {
      return MESSAGES.system.notFoundGeneric;
    }

    if (errObj.message) {
      return mapErrorMessageString(errObj.message, fallbackMessage);
    }
  }

  const refId = generateReferenceId();
  if (typeof console !== 'undefined') {
    console.error(`[Unhandled Error Ref: ${refId}]`, error);
  }
  return MESSAGES.system.unexpected(refId);
}

function mapErrorMessageString(msg: string, fallback?: string): UserMessage {
  const lower = msg.toLowerCase();

  // AI service
  if (
    lower.includes('ai') &&
    (lower.includes('busy') ||
      lower.includes('overloaded') ||
      lower.includes('rate limit') ||
      lower.includes('quota') ||
      lower.includes('temporarily'))
  ) {
    return MESSAGES.uploadsAndAi.aiBusy;
  }

  // Join codes
  if (lower.includes('invalid or disabled code') || lower.includes('invalid code')) {
    return MESSAGES.classes.invalidCode;
  }

  // Exam scheduling
  if (lower.includes('not open yet')) {
    return MESSAGES.exams.notOpenYet;
  }
  if (lower.includes('exam is closed') || lower.includes('already closed')) {
    return MESSAGES.exams.alreadyClosed;
  }
  if (lower.includes('already submitted')) {
    return MESSAGES.exams.alreadySubmitted;
  }
  if (lower.includes('time expired')) {
    return MESSAGES.exams.timeExpired;
  }

  // Network
  if (lower.includes('network') || lower.includes('offline') || lower.includes('failed to fetch')) {
    return MESSAGES.system.offline;
  }

  // Files
  if (lower.includes('file is too large') || lower.includes('exceeds')) {
    return MESSAGES.uploadsAndAi.fileTooLarge;
  }
  if (lower.includes('file type') || lower.includes('unsupported format')) {
    return MESSAGES.uploadsAndAi.wrongFileType;
  }

  if (fallback) {
    return {
      type: 'error',
      message: fallback,
    };
  }

  const refId = generateReferenceId();
  if (typeof console !== 'undefined') {
    console.error(`[Server Message Ref: ${refId}]`, msg);
  }
  return MESSAGES.system.unexpected(refId);
}

