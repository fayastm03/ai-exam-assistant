import { describe, it, expect } from 'vitest';
import {
  mapAuthError,
  mapUrlAuthParam,
  mapApiError,
  generateReferenceId,
  MESSAGES,
} from '@/lib/messages';

describe('Centralized Messages System (lib/messages.ts)', () => {
  describe('Supabase Auth Error Mapping', () => {
    it('maps invalid credentials to generic email and password message', () => {
      const msg = mapAuthError(new Error('Invalid login credentials'));
      expect(msg.type).toBe('error');
      expect(msg.message).toBe(
        "That email and password don't match. Check them and try again, or reset your password."
      );
    });

    it('maps unconfirmed email to warning message with resend action', () => {
      const msg = mapAuthError({ message: 'Email not confirmed' });
      expect(msg.type).toBe('warning');
      expect(msg.message).toContain('Please confirm your email address before signing in');
      expect(msg.actionKey).toBe('resend_confirmation');
    });

    it('maps email rate limit exceeded to friendly retry message', () => {
      const msg = mapAuthError(new Error('email rate limit exceeded'));
      expect(msg.type).toBe('warning');
      expect(msg.message).toBe('Too many sign-up emails were sent. Please wait a few minutes and try again.');
    });

    it('maps expired or invalid token to expired link message', () => {
      const msg = mapAuthError(new Error('Token has expired or is invalid'));
      expect(msg.type).toBe('error');
      expect(msg.message).toBe('This link has expired or has already been used. Please request a new one.');
      expect(msg.actionKey).toBe('request_new_link');
    });

    it('maps email already registered to sign in advice', () => {
      const msg = mapAuthError(new Error('User already registered'));
      expect(msg.type).toBe('error');
      expect(msg.message).toBe(
        'An account with this email address already exists. Try signing in instead, or reset your password.'
      );
    });

    it('maps weak password to specific length & composition rule', () => {
      const msg = mapAuthError(new Error('Password should be at least 6 characters'));
      expect(msg.type).toBe('error');
      expect(msg.message).toBe(
        'Your password must be at least 8 characters long and contain a mix of letters and numbers.'
      );
    });

    it('returns an unexpected error with a reference ID for unknown auth errors', () => {
      const msg = mapAuthError(new Error('Unknown DB connection reset'));
      expect(msg.type).toBe('error');
      expect(msg.message).toContain('An unexpected problem occurred (reference:');
      expect(msg.referenceId).toBeDefined();
    });
  });

  describe('URL Auth Status Parameters', () => {
    it('maps auth_required to info type, not error', () => {
      const msg = mapUrlAuthParam('auth_required');
      expect(msg).not.toBeNull();
      expect(msg?.type).toBe('info');
      expect(msg?.message).toBe('Please sign in to continue.');
    });

    it('maps session_expired to info message with saved answers explanation', () => {
      const msg = mapUrlAuthParam('session_expired');
      expect(msg).not.toBeNull();
      expect(msg?.type).toBe('info');
      expect(msg?.message).toContain('answers have been saved');
    });

    it('maps role mismatch params correctly', () => {
      const teacherMsg = mapUrlAuthParam('teacher_required');
      expect(teacherMsg?.type).toBe('error');
      expect(teacherMsg?.message).toContain("don't have permission to access the teacher dashboard");

      const studentMsg = mapUrlAuthParam('student_required');
      expect(studentMsg?.type).toBe('error');
      expect(studentMsg?.message).toContain("don't have permission to access the student portal");
    });
  });

  describe('API and System Error Mapping', () => {
    it('maps AI overload / busy state cleanly without breaking exam flow', () => {
      const msg = mapApiError(new Error('AI service rate limit reached'));
      expect(msg.type).toBe('warning');
      expect(msg.message).toContain('AI service is temporarily busy');
      expect(msg.message).toContain('exam and marking are not affected');
    });

    it('maps invalid or disabled join code generically without revealing code existence', () => {
      const msg = mapApiError(new Error('Invalid or disabled code'));
      expect(msg.type).toBe('error');
      expect(msg.message).toBe("That code didn't work. Check it with your teacher.");
    });

    it('maps network drop / offline state to reassurance that answers remain on screen', () => {
      const msg = mapApiError(new Error('Failed to fetch'));
      expect(msg.type).toBe('warning');
      expect(msg.message).toBe(
        'Connection issue detected. Your answers remain saved on screen and will sync as soon as you reconnect.'
      );
    });

    it('maps file size limit exceeded to 10MB limit rule', () => {
      const msg = mapApiError(new Error('file is too large'));
      expect(msg.type).toBe('error');
      expect(msg.message).toBe('The selected file is too large. Upload files under 10MB.');
    });

    it('generates consistent reference IDs', () => {
      const id1 = generateReferenceId();
      const id2 = generateReferenceId();
      expect(id1).toHaveLength(8);
      expect(id2).toHaveLength(8);
      expect(id1).not.toBe(id2);
    });
  });
});

