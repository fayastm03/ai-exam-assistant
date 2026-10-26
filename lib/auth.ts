import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export interface ProfileRecord {
  id: string;
  name: string;
  role: 'teacher' | 'student';
  created_at: string;
  updated_at: string;
}

export type AuthTeacherResult =
  | {
      ok: true;
      user: User;
      profile: ProfileRecord;
    }
  | {
      ok: false;
      response: NextResponse;
    };

/**
 * Authenticates the user and verifies that they possess the 'teacher' role.
 * Supports:
 *  1. `Authorization: Bearer <token>` header (Postman, mobile / Flutter app)
 *  2. Browser cookies (Next.js App Router session via @supabase/ssr)
 */
export async function requireTeacher(request: NextRequest): Promise<AuthTeacherResult> {
  const serviceRole = createServiceRoleClient();
  let authUser: User | null = null;

  // 1. Check for Authorization header (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      const { data, error } = await serviceRole.auth.getUser(token);
      if (!error && data?.user) {
        authUser = data.user;
      }
    }
  }

  // 2. If no valid Bearer token, check browser cookie session
  if (!authUser) {
    try {
      const cookieStore = await cookies();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

      const cookieClient = createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore in read-only / route handler responses where headers are flushed
            }
          },
        },
      });

      const { data, error } = await cookieClient.auth.getUser();
      if (!error && data?.user) {
        authUser = data.user;
      }
    } catch {
      // Cookies not accessible or error reading
    }
  }

  // If still not authenticated, return 401
  if (!authUser) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Valid authentication credentials required (Bearer token or session cookie)',
        },
        { status: 401 }
      ),
    };
  }

  // 3. Fetch authoritative profile from database to verify role
  const { data: profile, error: profileError } = await serviceRole
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (profileError || !profile) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'User profile not found',
        },
        { status: 401 }
      ),
    };
  }

  // 4. Verify teacher role
  if (profile.role !== 'teacher') {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Access denied: Teacher role required',
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    user: authUser,
    profile: profile as ProfileRecord,
  };
}

