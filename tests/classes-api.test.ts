import { describe, it, expect } from 'vitest';
import {
  classCreateSchema,
  classUpdateSchema,
  classMemberUpdateSchema,
  examAssignClassesSchema,
} from '@/lib/validations/teacher';
import { joinClassSchema } from '@/lib/validations/student';
import { generateRandomJoinCode, JOIN_CODE_ALPHABET } from '@/lib/classes';

describe('Classes Step C: API Validations & Utilities', () => {
  describe('Join code generator', () => {
    it('generates a 6-character code strictly from the alphabet without look-alike characters', () => {
      // Must not contain 0, O, 1, I
      expect(JOIN_CODE_ALPHABET).not.toContain('0');
      expect(JOIN_CODE_ALPHABET).not.toContain('O');
      expect(JOIN_CODE_ALPHABET).not.toContain('1');
      expect(JOIN_CODE_ALPHABET).not.toContain('I');

      for (let i = 0; i < 50; i++) {
        const code = generateRandomJoinCode();
        expect(code).toHaveLength(6);
        for (const char of code) {
          expect(JOIN_CODE_ALPHABET).toContain(char);
        }
      }
    });
  });

  describe('Teacher Class Schemas', () => {
    it('validates classCreateSchema correctly', () => {
      expect(classCreateSchema.safeParse({ name: 'Physics 101' }).success).toBe(true);
      expect(classCreateSchema.safeParse({ name: '' }).success).toBe(false);
      expect(classCreateSchema.safeParse({ name: '   ' }).success).toBe(false);
      expect(classCreateSchema.safeParse({ name: 'A'.repeat(101) }).success).toBe(false);
    });

    it('validates classUpdateSchema correctly', () => {
      expect(classUpdateSchema.safeParse({ name: 'New Name' }).success).toBe(true);
      expect(classUpdateSchema.safeParse({ join_enabled: false }).success).toBe(true);
      expect(classUpdateSchema.safeParse({ name: 'New Name', join_enabled: true }).success).toBe(true);
      expect(classUpdateSchema.safeParse({ name: '' }).success).toBe(false);
    });

    it('validates classMemberUpdateSchema correctly', () => {
      expect(classMemberUpdateSchema.safeParse({ status: 'approved' }).success).toBe(true);
      expect(classMemberUpdateSchema.safeParse({ status: 'rejected' }).success).toBe(true);
      expect(classMemberUpdateSchema.safeParse({ status: 'removed' }).success).toBe(true);
      expect(classMemberUpdateSchema.safeParse({ status: 'pending' }).success).toBe(false);
      expect(classMemberUpdateSchema.safeParse({ status: 'invalid' }).success).toBe(false);
    });

    it('validates examAssignClassesSchema correctly', () => {
      expect(
        examAssignClassesSchema.safeParse({
          class_ids: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
        }).success
      ).toBe(true);
      expect(
        examAssignClassesSchema.safeParse({
          class_ids: [],
        }).success
      ).toBe(true);
      expect(
        examAssignClassesSchema.safeParse({
          class_ids: ['not-a-uuid'],
        }).success
      ).toBe(false);
    });
  });

  describe('Student Class Schemas', () => {
    it('validates joinClassSchema correctly', () => {
      expect(joinClassSchema.safeParse({ code: 'ABC234' }).success).toBe(true);
      expect(joinClassSchema.safeParse({ code: '  xyz999  ' }).success).toBe(true);
      expect(joinClassSchema.safeParse({ code: '' }).success).toBe(false);
      expect(joinClassSchema.safeParse({ code: '   ' }).success).toBe(false);
    });
  });

  describe('Timing Status Computation Logic', () => {
    it('accurately resolves timing_status based on open_at, close_at and student attempt', () => {
      const now = new Date('2026-10-27T12:00:00Z');

      function computeTimingStatus(
        openAt: string | null,
        closeAt: string | null,
        attemptStatus: string | null
      ) {
        if (attemptStatus === 'submitted' || attemptStatus === 'auto_submitted') {
          return 'completed';
        }
        if (openAt && now < new Date(openAt)) {
          return 'upcoming';
        }
        if (closeAt && now > new Date(closeAt)) {
          return 'closed';
        }
        return 'available';
      }

      // 1. Completed
      expect(
        computeTimingStatus(
          '2026-10-27T10:00:00Z',
          '2026-10-27T14:00:00Z',
          'submitted'
        )
      ).toBe('completed');

      expect(
        computeTimingStatus(
          '2026-10-27T10:00:00Z',
          '2026-10-27T14:00:00Z',
          'auto_submitted'
        )
      ).toBe('completed');

      // 2. Upcoming
      expect(
        computeTimingStatus(
          '2026-10-27T13:00:00Z',
          '2026-10-27T15:00:00Z',
          null
        )
      ).toBe('upcoming');

      // 3. Closed
      expect(
        computeTimingStatus(
          '2026-10-27T08:00:00Z',
          '2026-10-27T11:00:00Z',
          null
        )
      ).toBe('closed');

      // 4. Available
      expect(
        computeTimingStatus(
          '2026-10-27T10:00:00Z',
          '2026-10-27T14:00:00Z',
          null
        )
      ).toBe('available');

      expect(computeTimingStatus(null, null, null)).toBe('available');
    });
  });
});
