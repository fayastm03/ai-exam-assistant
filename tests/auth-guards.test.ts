/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

let mockGetUserResult: any = { data: { user: null }, error: null };
let mockProfileResult: any = { data: null, error: null };

const mockAuthServiceRole = {
  auth: {
    getUser: vi.fn(async () => mockGetUserResult),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => mockProfileResult),
      })),
    })),
  })),
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => mockAuthServiceRole,
  createAdminClient: () => mockAuthServiceRole,
  createServerClient: () => mockAuthServiceRole,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn(async () => mockGetUserResult),
    },
  }),
}));

import { requireAuth, requireTeacher, requireStudent } from '@/lib/auth';

describe('Classes Step A: Authentication & Security Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Trigger Hardening: handle_new_user role assignment', () => {
    it('verifies handle_new_user trigger in migrations never reads role from raw_user_meta_data and hardcodes student', () => {
      const migrationFile = path.resolve(
        process.cwd(),
        'supabase/migrations/20261026233000_harden_handle_new_user_student_only.sql'
      );
      expect(fs.existsSync(migrationFile)).toBe(true);
      const sqlContent = fs.readFileSync(migrationFile, 'utf8');

      // Must explicitly set 'student'
      expect(sqlContent).toContain("'student'");
      // Must NOT extract role from raw_user_meta_data
      expect(sqlContent).not.toMatch(/raw_user_meta_data\s*->>\s*'role'/i);
    });

    it('verifies initial schema migration was updated to prevent student-to-teacher escalation', () => {
      const initMigrationFile = path.resolve(
        process.cwd(),
        'supabase/migrations/20261026151500_init_exam_assistant_schema.sql'
      );
      const sqlContent = fs.readFileSync(initMigrationFile, 'utf8');
      expect(sqlContent).not.toMatch(/raw_user_meta_data\s*->>\s*'role'/i);
    });
  });

  describe('lib/auth.ts: requireAuth email_confirmed_at enforcement', () => {
    it('rejects unconfirmed email users with HTTP 403 for browser cookie sessions', async () => {
      mockGetUserResult = {
        data: {
          user: {
            id: 'usr-unconfirmed-cookie',
            email: 'unconfirmed@student.edu',
            email_confirmed_at: null,
          },
        },
        error: null,
      };

      const req = new NextRequest('http://localhost:3000/api/student/exams');
      const authResult = await requireAuth(req);

      expect(authResult.ok).toBe(false);
      if (!authResult.ok) {
        expect(authResult.response.status).toBe(403);
        const json = await authResult.response.json();
        expect(json.code).toBe('email_not_confirmed');
        expect(json.error).toBe('Forbidden');
        expect(json.message).toContain('Email address not confirmed');
      }
    });

    it('rejects unconfirmed email users with HTTP 403 for Bearer token sessions', async () => {
      mockGetUserResult = {
        data: {
          user: {
            id: 'usr-unconfirmed-bearer',
            email: 'bearer@student.edu',
            email_confirmed_at: undefined,
          },
        },
        error: null,
      };

      const req = new NextRequest('http://localhost:3000/api/student/exams', {
        headers: {
          authorization: 'Bearer token-12345',
        },
      });

      const authResult = await requireAuth(req);

      expect(authResult.ok).toBe(false);
      if (!authResult.ok) {
        expect(authResult.response.status).toBe(403);
        const json = await authResult.response.json();
        expect(json.code).toBe('email_not_confirmed');
      }
    });

    it('allows authenticated users whose email is confirmed', async () => {
      mockGetUserResult = {
        data: {
          user: {
            id: 'usr-confirmed-1',
            email: 'confirmed@student.edu',
            email_confirmed_at: '2026-10-26T12:00:00Z',
          },
        },
        error: null,
      };

      mockProfileResult = {
        data: {
          id: 'usr-confirmed-1',
          name: 'Jane Student',
          role: 'student',
          created_at: '2026-10-26T00:00:00Z',
          updated_at: '2026-10-26T00:00:00Z',
        },
        error: null,
      };

      const req = new NextRequest('http://localhost:3000/api/student/exams', {
        headers: {
          authorization: 'Bearer token-valid',
        },
      });

      const authResult = await requireAuth(req);

      expect(authResult.ok).toBe(true);
      if (authResult.ok) {
        expect(authResult.user.id).toBe('usr-confirmed-1');
        expect(authResult.user.email_confirmed_at).toBe('2026-10-26T12:00:00Z');
        expect(authResult.profile.role).toBe('student');
      }
    });

    it('requireTeacher rejects students with 403', async () => {
      mockGetUserResult = {
        data: {
          user: {
            id: 'usr-student-1',
            email: 'student@school.edu',
            email_confirmed_at: '2026-10-26T12:00:00Z',
          },
        },
        error: null,
      };

      mockProfileResult = {
        data: {
          id: 'usr-student-1',
          name: 'Student One',
          role: 'student',
        },
        error: null,
      };

      const req = new NextRequest('http://localhost:3000/api/teacher/exams', {
        headers: {
          authorization: 'Bearer token-student',
        },
      });

      const authResult = await requireTeacher(req);

      expect(authResult.ok).toBe(false);
      if (!authResult.ok) {
        expect(authResult.response.status).toBe(403);
        const json = await authResult.response.json();
        expect(json.message).toContain('Teacher role required');
      }
    });

    it('requireStudent rejects teachers with 403', async () => {
      mockGetUserResult = {
        data: {
          user: {
            id: 'usr-teacher-1',
            email: 'teacher@school.edu',
            email_confirmed_at: '2026-10-26T12:00:00Z',
          },
        },
        error: null,
      };

      mockProfileResult = {
        data: {
          id: 'usr-teacher-1',
          name: 'Teacher One',
          role: 'teacher',
        },
        error: null,
      };

      const req = new NextRequest('http://localhost:3000/api/student/exams', {
        headers: {
          authorization: 'Bearer token-teacher',
        },
      });

      const authResult = await requireStudent(req);

      expect(authResult.ok).toBe(false);
      if (!authResult.ok) {
        expect(authResult.response.status).toBe(403);
        const json = await authResult.response.json();
        expect(json.message).toContain('Student role required');
      }
    });
  });
});
