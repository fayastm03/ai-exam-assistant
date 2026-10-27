import { describe, it, expect } from 'vitest';
import {
  normalizeJoinCode,
  resolveJoinStatus,
  computeExamTimingStatus,
} from '@/lib/classes';

describe('Classes Pure Logic Unit Tests', () => {
  describe('1. Join Code Normalisation (normalizeJoinCode)', () => {
    it('trims leading and trailing whitespace', () => {
      expect(normalizeJoinCode('   ABC123   ')).toBe('ABC123');
      expect(normalizeJoinCode('\tDEMO26\n')).toBe('DEMO26');
    });

    it('converts lowercase characters to uppercase', () => {
      expect(normalizeJoinCode('abcdef')).toBe('ABCDEF');
      expect(normalizeJoinCode('demo26')).toBe('DEMO26');
      expect(normalizeJoinCode('29xab8')).toBe('29XAB8');
    });

    it('handles mixed-case input with surrounding spaces', () => {
      expect(normalizeJoinCode('  deMO26  ')).toBe('DEMO26');
      expect(normalizeJoinCode('   AbCdEf   ')).toBe('ABCDEF');
    });

    it('strips non-alphanumeric characters or spaces within the code', () => {
      expect(normalizeJoinCode('AB-CD-EF')).toBe('ABCDEF');
      expect(normalizeJoinCode('DE MO 26')).toBe('DEMO26');
      expect(normalizeJoinCode('DE#MO$26!')).toBe('DEMO26');
    });

    it('returns empty string for empty, whitespace-only, null, or undefined inputs', () => {
      expect(normalizeJoinCode('')).toBe('');
      expect(normalizeJoinCode('   ')).toBe('');
      expect(normalizeJoinCode(null)).toBe('');
      expect(normalizeJoinCode(undefined)).toBe('');
    });
  });

  describe('2. Join Status Rules (resolveJoinStatus)', () => {
    it('handles no membership (null / undefined): creates new pending request', () => {
      const resNull = resolveJoinStatus(null);
      expect(resNull.nextStatus).toBe('pending');
      expect(resNull.action).toBe('insert');
      expect(resNull.message).toBe('Join request submitted and pending teacher approval');

      const resUndef = resolveJoinStatus(undefined);
      expect(resUndef.nextStatus).toBe('pending');
      expect(resUndef.action).toBe('insert');
      expect(resUndef.message).toBe('Join request submitted and pending teacher approval');
    });

    it('handles pending status: returns current status without creating a duplicate', () => {
      const res = resolveJoinStatus('pending');
      expect(res.nextStatus).toBe('pending');
      expect(res.action).toBe('noop');
      expect(res.message).toBe('Your join request is already pending approval');
    });

    it('handles approved status: returns approved status without error', () => {
      const res = resolveJoinStatus('approved');
      expect(res.nextStatus).toBe('approved');
      expect(res.action).toBe('noop');
      expect(res.message).toBe('You are an approved member of this class');
    });

    it('handles rejected status: remains rejected and does NOT create a new request', () => {
      const res = resolveJoinStatus('rejected');
      expect(res.nextStatus).toBe('rejected');
      expect(res.action).toBe('rejected');
      expect(res.message).toBe('Your join request for this class was previously rejected');
    });

    it('handles removed status: resets membership back to pending', () => {
      const res = resolveJoinStatus('removed');
      expect(res.nextStatus).toBe('pending');
      expect(res.action).toBe('update');
      expect(res.message).toBe('Join request re-submitted and pending approval');
    });
  });

  describe('3. Student Exam Timing Status (computeExamTimingStatus)', () => {
    const fixedNow = new Date('2026-10-27T12:00:00.000Z');

    it('returns "completed" if attempt status is submitted or auto_submitted regardless of timing', () => {
      // Even if open window is closed or upcoming
      expect(
        computeExamTimingStatus({
          open_at: '2026-10-28T00:00:00.000Z',
          attemptStatus: 'submitted',
          now: fixedNow,
        })
      ).toBe('completed');

      expect(
        computeExamTimingStatus({
          close_at: '2026-10-25T00:00:00.000Z',
          attemptStatus: 'auto_submitted',
          now: fixedNow,
        })
      ).toBe('completed');
    });

    it('returns "upcoming" when open_at is in the future', () => {
      const futureOpen = '2026-10-27T14:00:00.000Z'; // 2 hours in future
      expect(
        computeExamTimingStatus({
          open_at: futureOpen,
          close_at: '2026-10-27T18:00:00.000Z',
          attemptStatus: null,
          now: fixedNow,
        })
      ).toBe('upcoming');
    });

    it('returns "closed" when close_at is in the past', () => {
      const pastClose = '2026-10-27T10:00:00.000Z'; // 2 hours in past
      expect(
        computeExamTimingStatus({
          open_at: '2026-10-27T08:00:00.000Z',
          close_at: pastClose,
          attemptStatus: null,
          now: fixedNow,
        })
      ).toBe('closed');
    });

    it('returns "available" when current time is between open_at and close_at', () => {
      expect(
        computeExamTimingStatus({
          open_at: '2026-10-27T10:00:00.000Z',
          close_at: '2026-10-27T14:00:00.000Z',
          attemptStatus: null,
          now: fixedNow,
        })
      ).toBe('available');
    });

    it('returns "available" when in_progress attempt exists during open window', () => {
      expect(
        computeExamTimingStatus({
          open_at: '2026-10-27T10:00:00.000Z',
          close_at: '2026-10-27T14:00:00.000Z',
          attemptStatus: 'in_progress',
          now: fixedNow,
        })
      ).toBe('available');
    });

    it('returns "available" when no window restrictions (open enrollment)', () => {
      expect(
        computeExamTimingStatus({
          open_at: null,
          close_at: null,
          attemptStatus: null,
          now: fixedNow,
        })
      ).toBe('available');
    });
  });
});
