import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Do not run any logic between createServerClient and supabase.auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isTeacherRoute = pathname.startsWith('/teacher');
  const isStudentRoute =
    pathname.startsWith('/exams') ||
    pathname.startsWith('/classes') ||
    pathname === '/join';
  const isRootRoute = pathname === '/';

  // 1. If user is NOT logged in:
  if (!user) {
    if (isTeacherRoute || isStudentRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      if (pathname === '/join') {
        const fullJoinPath = request.nextUrl.search ? `/join${request.nextUrl.search}` : '/join';
        url.search = '';
        url.searchParams.set('next', fullJoinPath);
      } else {
        url.searchParams.set('error', 'auth_required');
      }
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // 2. If user is logged in, check email confirmation
  if (!user.email_confirmed_at) {
    if (isTeacherRoute || isStudentRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'email_not_confirmed');
      if (pathname === '/join') {
        const fullJoinPath = request.nextUrl.search ? `/join${request.nextUrl.search}` : '/join';
        url.searchParams.set('next', fullJoinPath);
      }
      return NextResponse.redirect(url);
    }
    // Allow unconfirmed users to access auth routes (like /signup/check-email or /login)
    return supabaseResponse;
  }

  // 3. User is logged in and confirmed. Get role from profiles table:
  let role = 'student';
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role) {
    role = profile.role;
  } else if (user.user_metadata?.role) {
    role = user.user_metadata.role;
  }

  // Handle root route
  if (isRootRoute) {
    const url = request.nextUrl.clone();
    url.pathname = role === 'teacher' ? '/teacher/exams' : '/exams';
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from /login or /signup
  if (pathname === '/login' || pathname === '/signup') {
    const next = request.nextUrl.searchParams.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      const isTeacherTarget = next.startsWith('/teacher');
      if (role === 'teacher' && isTeacherTarget) {
        return NextResponse.redirect(new URL(next, request.url));
      }
      if (role === 'student' && !isTeacherTarget) {
        return NextResponse.redirect(new URL(next, request.url));
      }
    }
    const url = request.nextUrl.clone();
    url.pathname = role === 'teacher' ? '/teacher/exams' : '/exams';
    return NextResponse.redirect(url);
  }

  // Prevent role cross-access
  if (isTeacherRoute && role !== 'teacher') {
    const url = request.nextUrl.clone();
    url.pathname = '/exams';
    url.searchParams.set('error', 'teacher_required');
    return NextResponse.redirect(url);
  }

  if (isStudentRoute && role !== 'student') {
    const url = request.nextUrl.clone();
    url.pathname = '/teacher/classes';
    url.searchParams.set('error', 'student_required');
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const middleware = proxy;
export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes have their own guards)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
