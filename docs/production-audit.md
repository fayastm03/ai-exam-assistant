# Production Hardening Audit Report

**Date**: November 2, 2026  
**Status**: STAGE 1 AUDIT ONLY (No code modified)  
**Scope**: Full codebase audit across Auth & Sessions, API & Data Security, Web Security & Configuration, Clean Code & Removal, and Reliability, Operations & Quality.

---

## 1. Executive Summary & Findings Matrix

| ID | Area | File(s) Affected | Problem Description | Severity | Proposed Fix | Risk of Fix |
|---|---|---|---|---|---|---|
| **A1.1** | Auth & Sessions | `app/page.tsx` | Decides access in browser via `useEffect` and `supabase.auth.getSession()` client call, leading to client flash and unauthorized redirection reliance. | **High** | Convert `app/page.tsx` to an async Server Component (or redirect in `proxy.ts`/server layout) using SSR cookie client and `supabase.auth.getUser()`. | **Low** |
| **A1.2** | Auth & Sessions | `app/reset-password/page.tsx` | Calls `supabase.auth.getSession()` twice in client component. | **Medium** | Replace `getSession()` with `getUser()` via browser client. | **Low** |
| **A1.3** | Auth & Sessions | `proxy.ts` | Route matching regex excludes `api` completely (`(?!api|...)`), so API routes bypass middleware session refresh and cookie rotation. Also falls back to `user.user_metadata?.role` if profile query returns null. | **High** | Remove `user_metadata?.role` fallback; only trust `profiles` table. Ensure session refresh is handled consistently across SSR cookie clients. Note: in Next.js 16 App Router, the proxy convention handles request routing before handlers. | **Medium** |
| **A2.1** | Auth & Sessions | `app/api/auth/resend-confirmation/route.ts` | Public endpoint querying Supabase without standard rate limiting or auth guard. Returns information without standardized envelope. | **Medium** | Enforce standardized IP/email rate limiting via database table or headers, prevent timing enumeration attacks. | **Low** |
| **A3.1** | Auth & Sessions | `supabase/migrations/20261026233000_harden_handle_new_user_student_only.sql` | `handle_new_user()` trigger strictly forces `role = 'student'` and ignores `raw_user_meta_data->>'role'`. Verified secure: impossible to become teacher via signup, metadata, body, or query string. | **Low** (Informational) | Document in runbook how teachers are provisioned (direct SQL/admin seed). | **None** |
| **A4.1** | Auth & Sessions | `app/auth/callback/route.ts`, `proxy.ts`, `components/auth/auth-card.tsx` | Open redirect check tests `next.startsWith('/') && !next.startsWith('//')`. However, backslash tricks (`/\evil.com`) or encoded bypasses (`/%2f/evil.com`) can trick naive startsWith on older browsers/runtimes. | **Medium** | Implement a strict `getSafeRedirectUrl(next, defaultPath)` helper that parses the URL with `new URL(next, origin)` and asserts `url.origin === origin` and valid path regex `^\/[a-zA-Z0-9_\-\/\?=\&\#\.]*$`. | **Low** |
| **A5.1** | Auth & Sessions | `components/auth/auth-card.tsx`, `app/reset-password/page.tsx` | Password rules enforce length >= 8, but do not check for common/compromised passwords (e.g. `password123`, `12345678`). No CAPTCHA integrated on signup/reset forms. | **Medium** | Add a common password denylist check (top 100 common passwords) in Zod schema and client validation. Create plug-in integration point for Cloudflare Turnstile token verification in auth actions. | **Low** |
| **A6.1** | Auth & Sessions | `lib/supabase/client.ts`, `lib/auth.ts`, `app/api/auth/signout/route.ts` | Session cookies rely on default `@supabase/ssr` settings. In `app/api/auth/signout/route.ts`, cookies are cleared, but cookie attributes should explicitly enforce `httpOnly`, `secure: true`, `sameSite: 'lax'` on production. Exam taker handles token expiration gracefully but should alert on mid-test session expiry. | **Medium** | Explicitly pass secure cookie options in `@supabase/ssr` server cookie handler. Provide safe session expiry warning during exam taking. | **Low** |
| **A7.1** | Auth & Sessions | Teacher Accounts & MFA | Teachers are created via SQL seed or admin. No multi-factor authentication (MFA/TOTP) support exists yet for teacher accounts. | **Low** (Recommendation) | Add Supabase MFA enrollment and verification hook recommendation for teachers. | **Low** |
| **B8.1** | API & Data Security | `app/api/student/exams/[id]/route.ts`, `app/api/student/exams/[id]/attempt/route.ts`, `app/api/student/exams/[id]/result/route.ts`, `app/api/student/exams/[id]/ai-feedback/route.ts`, `app/api/teacher/classes/[id]/route.ts`, `app/api/teacher/exams/[id]/route.ts`, etc. | Several GET/DELETE routes validate query params or context params ad-hoc rather than using uniform Zod schemas. Request body size limit is not enforced across all POST/PUT routes (e.g. answer saving, bulk-paste). | **High** | Add a lightweight middleware wrapper or helper `validateRequest({ params, body, query, maxBodyBytes })` to enforce Zod schemas on params, query, and payload size (e.g., 256KB for JSON, 4.5MB for uploads). | **Medium** |
| **B8.2** | API & Data Security | `app/api/teacher/exams/[id]/route.ts`, `app/api/teacher/classes/[id]/route.ts` | Mass assignment check: Some update handlers selectively pick fields (`title`, `instructions`, etc.), but exam/class creation should ensure no extra body fields can be injected into database queries. | **Medium** | Verify all Zod schemas use `.strict()` or explicit pick mappings so unexpected database columns cannot be mass-assigned. | **Low** |
| **B9.1** | API & Data Security | All mutation routes (`POST`, `PUT`, `DELETE`, `PATCH`) | No CSRF verification on state-changing API endpoints. While browser Fetch from modern browsers uses `SameSite=Lax` cookies, cross-site POSTs without custom headers or Origin verification could present CSRF risks. CORS headers are currently not explicitly restricted. | **High** | In `lib/auth.ts` / API guard, enforce Origin header verification for state-changing requests (`request.headers.get('origin') === siteOrigin`). Prohibit wildcard CORS. | **Low** |
| **B10.1** | API & Data Security | `lib/supabase/server.ts` & 22 API/Layout files | `createServiceRoleClient` is used in 22 files across the app. `lib/supabase/server.ts` has `import 'server-only'`, but route files do not document why RLS bypass is required per file. | **Medium** | Keep `import 'server-only'` in `lib/supabase/server.ts`. Add explicit comments in each calling route explaining why service role is necessary (e.g., student submission calculating authoritative score, system rate-limiting table, teacher cross-querying attempts). | **Low** |
| **B11.1** | API & Data Security | `supabase/migrations/*.sql` | RLS is enabled on all tables (`profiles`, `exams`, `questions`, `attempts`, `attempt_answers`, `attempt_feedback`, `classes`, `class_members`, `exam_classes`, `join_attempts`). Security definer functions all set `search_path = ''`. However, foreign key columns like `questions.exam_id`, `attempts.student_id`, `attempt_answers.question_id` need composite index optimization for large datasets. | **Low** | Migration 20261026151500 already created indexes on most FKs. Prepare a supplementary migration for composite index coverage (`attempts(exam_id, student_id)`, `attempt_answers(attempt_id, question_id)`). | **Low** |
| **B12.1** | API & Data Security | `app/api/teacher/exams/[id]/import/route.ts` & `generate/route.ts` | Upload file type check in `isAllowedFile` checks `file.type` and filename extension (`.pdf`, `.docx`, `.png`, `.jpg`). It does not verify file magic bytes before passing buffers to mammoth or Gemini. | **Medium** | Implement magic byte verification (check initial buffer bytes for PDF `%PDF-`, PNG `\x89PNG`, JPEG `\xFF\xD8\xFF`, and ZIP/DOCX `PK\x03\x04`). | **Low** |
| **B13.1** | API & Data Security | `lib/ai/` (`explainer.ts`, `generator.ts`, `paper-extractor.ts`, `student-feedback.ts`) | AI safety: Gemini API keys are server-only. Student names and emails are never passed to AI. Zod validates AI outputs. However, AI routes lack a per-user sliding window call cap and daily cost cap. | **High** | Implement a per-teacher and per-student sliding rate limit / daily call counter in database table or Upstash Redis to prevent API quota drain and runaway costs. | **Low** |
| **B14.1** | API & Data Security | `app/api/student/classes/join/route.ts` vs other routes | `join_attempts` table rate-limits class join codes (10 per 15 min). But AI generation, file import, and answer autosave endpoints do not have dedicated DB-backed rate limiters (they rely on client debouncing and AI provider retries). | **High** | Implement persistent rate-limiting for AI routes (`/api/teacher/exams/[id]/generate`, `/import`, `/explain`, `/bulk-ai-feedback`, and `/api/student/exams/[id]/ai-feedback`) using a database rate limit table or Redis. | **Medium** |
| **B15.1** | API & Data Security | Entire UI (`components/`, `app/`) | Audited for `dangerouslySetInnerHTML`: 0 matches found. Audited for `target="_blank"` without `rel="noopener noreferrer"`: 0 matches found. React safely escapes all dynamic values. | **Low** (Passed) | Maintain strict lint rules prohibiting unescaped HTML or raw DOM injection. | **None** |
| **C16.1** | Web Security & Config | `next.config.ts` | Missing security response headers: No Content-Security-Policy (CSP), Strict-Transport-Security (HSTS), X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy, or frame-ancestors: 'none'. `poweredByHeader` is not disabled. | **High** | Add `poweredByHeader: false` and `headers()` function in `next.config.ts` with comprehensive CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin. | **Medium** |
| **C17.1** | Web Security & Config | `lib/` & Root Startup | Environment variables are checked ad-hoc across files instead of validated upfront with Zod at startup. | **Medium** | Create `lib/env.ts` using Zod schema to validate `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, etc. at application boot, failing fast with clear errors. | **Low** |
| **C18.1** | Web Security & Config | `package.json` | `package.json` does not declare an `engines` field pinning Node.js version. `cn` package (`^0.5.0`) is installed alongside custom `lib/utils.ts` `cn` helper. | **Low** | Pin `engines: { "node": ">=20.x" }` in `package.json`. Remove redundant `cn` dependency. | **Low** |
| **D19.1** | Clean Code & Removal | `public/` & `app/` | Boilerplate files from initial Next.js template remain in `public/`: `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`. None are referenced in code. | **Low** | Delete unused SVG boilerplate files. | **Low** |
| **D19.2** | Clean Code & Removal | `lib/ai/provider.ts` | `console.log` logs token usage and latency in `lib/ai/provider.ts:149`. | **Low** | Replace with structured server telemetry logging with request id and without sensitive tokens. | **Low** |
| **D20.1** | Repo Hygiene | `.gitignore` & Git tracking | `.agents/` folder is tracked in Git (contains 41 markdown reference files for skills). `.aider-desk/` is in `.gitignore` and untracked. `.env*.local` is ignored and untracked. | **Low** | Add `.agents/` to `.gitignore` and untrack from Git index with `git rm -r --cached .agents`. Ensure `AGENTS.md` remains committed with Next.js rules and no secrets. | **Low** |
| **D21.1** | Heavy / Decorative Code | `components/auth/silk-shader-background.tsx` | WebGL Silk Shader runs only on `/login`, `/signup`, `/forgot-password`. Uses plain WebGL1 (0 external libraries). However, does not check `prefers-reduced-motion` media query and runs unconditionally on mobile/low-power devices. | **Medium** | Add `prefers-reduced-motion: reduce` listener to disable the RAF animation loop and render a graceful static gradient fallback. Ensure canvas remains excluded from all test/dashboard screens. | **Low** |
| **D22.1** | TypeScript & Code Quality | `lib/classes.ts:32`, `lib/ai/provider.ts:130` | 2 instances of `: any` / `as any` exist in `lib/classes.ts` and `lib/ai/provider.ts`. | **Low** | Replace `: any` with strict Supabase client type in `lib/classes.ts` and proper Gemini Content typing in `provider.ts`. | **Low** |
| **E23.1** | Reliability & Quality | Root & Route Error Boundaries | `app/error.tsx` and `app/global-error.tsx` exist with reference IDs. However, route segments like `/exams` and `/teacher` do not have nested `error.tsx` boundaries to catch localized subtree errors without breaking the root layout. | **Low** | Add localized `error.tsx` in `app/exams/` and `app/teacher/` or document centralized capture. Document Sentry integration point in `instrumentation.ts`. | **Low** |
| **E24.1** | Reliability & Quality | Queries & Performance | `lib/auth.ts:115` uses `.select('*')` on `profiles`. Layouts query `id, name, role`. | **Low** | Change `.select('*')` in `lib/auth.ts` to `.select('id, name, role, created_at, updated_at')`. Verify no unnecessary `select('*')` on large tables. | **Low** |
| **E25.1** | Metadata & Polish | Metadata, Legal & Polish | Private routes lack `robots: { index: false, follow: false }`. Missing `app/robots.ts`, Privacy Policy (`app/privacy/page.tsx`), and Terms of Service (`app/terms/page.tsx`) pages for student data compliance. | **Medium** | Create `app/robots.ts` blocking web crawlers on `/api/`, `/exams/`, `/teacher/`, `/classes/`. Create clean Privacy Policy and Terms of Service pages with contact info. | **Low** |
| **E26.1** | CI & Operations | `.github/workflows/` | No GitHub Actions workflow exists for automated lint, typecheck, test, and build on push. | **Medium** | Create `.github/workflows/ci.yml` running `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test`, and `npm run build`. | **Low** |
| **E27.1** | Backups & Runbook | Documentation | Runbook for deployment, key rotation, teacher account provisioning, and disaster recovery is missing. | **Low** | Create comprehensive `docs/runbook.md` with operational guides. | **Low** |

---

## 2. Detailed Findings by Area

### A. Auth and Sessions
1. **Client-Side Auth Decisions**:
   - `app/page.tsx` was using `supabase.auth.getSession()` inside a React `useEffect` to redirect users between `/login`, `/teacher/exams`, and `/exams`. This causes a client-side flash and fails if JavaScript is blocked or delayed.
   - `app/reset-password/page.tsx` calls `supabase.auth.getSession()` on mount.
   - *Fix*: Make `app/page.tsx` a Server Component that inspects the session via `@supabase/ssr` `getUser()` and immediately redirects via Next.js `redirect()`.
2. **Shared Server Auth Guard**:
   - `lib/auth.ts` provides `requireAuth`, `requireTeacher`, and `requireStudent`.
   - Every protected API route under `app/api/student/` and `app/api/teacher/` currently uses `requireStudent` or `requireTeacher`.
   - All guards read user verification (`email_confirmed_at`) and fetch authoritative `role` directly from the database `profiles` table.
   - All return consistent `401 Unauthorized` or `403 Forbidden` JSON payloads with error codes.
3. **Teacher Role Privilege Escalation**:
   - Database trigger `handle_new_user()` in `supabase/migrations/20261026233000_harden_handle_new_user_student_only.sql` strictly forces `role = 'student'`. Any `role` passed in `raw_user_meta_data`, request body, or query string is completely ignored.
   - Teacher accounts can only be provisioned by direct database update or admin script.
4. **Open Redirects**:
   - `app/auth/callback/route.ts` and `proxy.ts` check `next.startsWith('/') && !next.startsWith('//')`.
   - While effective for standard URLs, URLs with special encodings or backslashes could present edge cases.
   - *Fix*: Standardize redirect sanitization with a shared `validateSafeRedirect(url)` utility.
5. **Login Abuse & Generic Error Messages**:
   - `lib/messages.ts` handles authentication errors and displays generic messages (`"Invalid login credentials"`), preventing account enumeration.
   - Password validation currently checks length >= 8 and a mix of letters and numbers. A list of common passwords should be checked.
   - Cloudflare Turnstile CAPTCHA should have an explicit plug-in point for signup and password reset.
6. **Session Expiry & Cookie Flags**:
   - `@supabase/ssr` is configured to set cookies. Explicit `secure: true`, `sameSite: 'lax'`, and `httpOnly: true` flags should be verified in production cookies.
   - Exam taker (`app/exams/[id]/take/page.tsx`) already has auto-retry and offline queueing, but should show an alert if the session expires mid-test.

### B. API and Data Security
8. **Zod Validation, Method Restrictions & Mass Assignment**:
   - Mutation routes enforce `POST`/`PUT`/`DELETE` methods and validate payloads using Zod schemas (`lib/validations/`).
   - Query parameters in some routes are parsed without Zod.
   - Maximum body size is enforced in upload routes (4MB), but JSON routes do not set an explicit payload cap.
9. **CSRF & CORS**:
   - Next.js API routes are currently open to same-origin and cross-origin fetch if cookies are present.
   - State-changing API routes must check `Origin` or `Sec-Fetch-Site` header to prevent CSRF attacks from malicious external websites.
10. **Service Role Key Isolation**:
   - `SUPABASE_SERVICE_ROLE_KEY` is only used on the server (`lib/supabase/server.ts` has `import 'server-only'`).
   - It is never exposed in `NEXT_PUBLIC_` variables or sent to the browser.
   - Add explicit inline comments in API routes documenting why the service role client is used (e.g. bypassing RLS for teacher attempt grading calculations, system rate-limiting).
11. **Database Schema & RLS Policies**:
   - All 10 tables have Row Level Security enabled.
   - All security definer functions specify `set search_path = ''`.
   - Foreign key constraints have cascade rules, preventing orphan rows.
12. **File Storage & Upload Security**:
   - File uploads (`app/api/teacher/exams/[id]/import/route.ts` and `generate/route.ts`) enforce a 4MB limit and validate MIME types.
   - Magic bytes verification should be added to inspect binary headers before passing file buffers to parsers.
13. **AI Safety**:
   - Server-only API keys (`GEMINI_API_KEY`).
   - Prompt templates strictly treat student answers and document text as data (delimiters used).
   - Structured JSON output validated with Zod.
   - Zero student names or emails are sent to the AI.
   - Timeouts and retry caps with exponential backoff are configured.
   - Missing: Per-user sliding rate limits and daily cost caps.
14. **Persistent Rate Limiting**:
   - `join_attempts` table rate-limits student class join requests (10 per 15 min).
   - AI generation and exam answer autosave endpoints need rate-limiting rules.
15. **XSS Protection**:
   - No `dangerouslySetInnerHTML` found anywhere in the repository.
   - No unsafe `target="_blank"` without `rel="noopener noreferrer"`.

### C. Web Security & Configuration
16. **Security Headers**:
   - `next.config.ts` currently lacks security headers.
   - Must add:
     - `Content-Security-Policy`: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co; font-src 'self'; frame-ancestors 'none';`
     - `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`
     - `X-Content-Type-Options`: `nosniff`
     - `X-Frame-Options`: `DENY`
     - `Referrer-Policy`: `strict-origin-when-cross-origin`
     - `Permissions-Policy`: `camera=(), microphone=(), geolocation=()`
     - `poweredByHeader: false`
17. **Environment Variable Validation**:
   - Create `lib/env.ts` with Zod to validate required server and client env vars on startup.
18. **Dependencies & Engine Pinning**:
   - Add `"engines": { "node": ">=20.0.0" }` in `package.json`.
   - Remove redundant `cn` package from `dependencies`.

### D. Clean Code and Removal
19. **Dead Code & SVGs**:
   - Delete unused boilerplate SVGs in `public/`: `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`.
   - Zero `TODO` or `FIXME` comments found.
   - Replace `console.log` in `lib/ai/provider.ts` with structured server logging.
20. **Repo Hygiene & .gitignore**:
   - `.agents/` directory is currently tracked in Git. Untrack it using `git rm -r --cached .agents` and add `.agents/` to `.gitignore`.
   - `AGENTS.md` contains only Next.js documentation guidelines without secrets and will be preserved.
21. **Heavy / Decorative Code**:
   - `SilkShaderBackground` is pure WebGL1 (no Three.js, ~10KB). Runs only on `/login`, `/signup`, `/forgot-password`.
   - Update it to detect `window.matchMedia('(prefers-reduced-motion: reduce)')` and pause animation automatically.
22. **TypeScript Strictness**:
   - Fix 2 `: any` usages in `lib/classes.ts` and `lib/ai/provider.ts`. Zero `@ts-ignore` in codebase.

### E. Reliability, Operations and Quality
23. **Error Handling**:
   - `app/error.tsx` and `app/global-error.tsx` provide user-friendly screens with reference IDs.
   - Recommend Sentry SDK configuration in `instrumentation.ts`.
24. **Performance**:
   - In `lib/auth.ts`, replace `select('*')` with explicit column list `select('id, name, role, created_at, updated_at')`.
25. **Metadata & Legal Pages**:
   - Add `app/robots.ts` blocking private routes from search engine indexing.
   - Add `app/privacy/page.tsx` and `app/terms/page.tsx`.
26. **CI Workflow**:
   - Add `.github/workflows/ci.yml` running lint, typecheck, tests, and build.
   - Update `app/api/health/route.ts` to return simple `{ status: 'ok' }` without leaking internal connection metrics.
27. **Runbook**:
   - Create `docs/runbook.md` detailing deployment, rollbacks, secret rotation, teacher provisioning, and disaster recovery.

---

## 3. Implementation Plan for Stage 2 (Awaiting User Approval)

Upon user approval, fixes will be executed in the exact order requested, one commit per group with `npm run build`, `npm test`, and `npm run lint` verified after each:

1. **Commit 1: Cleanup & Repo Hygiene**
   - Untrack `.agents` from git and add `.agents/` to `.gitignore`.
   - Remove unused SVG boilerplate files (`public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`).
   - Remove redundant `cn` package dependency and pin Node engine in `package.json`.
   - Add `prefers-reduced-motion` check to `SilkShaderBackground`.

2. **Commit 2: Server-Side Auth, Middleware & Shared Guard**
   - Convert `app/page.tsx` to a Server Component using `@supabase/ssr` `getUser()`.
   - Standardize safe redirect verification utility (`getSafeRedirectUrl`).
   - Update `proxy.ts` and `lib/auth.ts` to eliminate `user_metadata?.role` fallback.
   - Replace `getSession()` in `app/reset-password/page.tsx` with `getUser()`.

3. **Commit 3: API Validation, Ownership, CSRF & Rate Limits**
   - Add Origin / CSRF verification on state-changing API requests.
   - Add body size limiter helper and strict Zod validation across query/context params.
   - Add DB-backed rate limiting utility for AI and sensitive endpoints.

4. **Commit 4: Security Headers & Env Validation**
   - Add complete security headers in `next.config.ts` (CSP, HSTS, X-Frame-Options, Permissions-Policy, nosniff, poweredByHeader: false).
   - Create `lib/env.ts` with Zod validation at application boot.

5. **Commit 5: AI & Upload Safety**
   - Implement magic byte inspection for file uploads in `app/api/teacher/exams/[id]/import` and `generate`.
   - Enforce daily/sliding window AI request caps per teacher/student.
   - Ensure clean structured server logging in `lib/ai/provider.ts`.

6. **Commit 6: Database Migration (Prepared File Only)**
   - Author `supabase/migrations/20261102000000_production_hardening_indexes_ratelimit.sql` with composite indexes and persistent rate limit tables.

7. **Commit 7: Metadata, Legal Pages, CI & Operations**
   - Add `app/robots.ts` with strict noindex rules for private areas.
   - Add `app/privacy/page.tsx` and `app/terms/page.tsx`.
   - Add `.github/workflows/ci.yml` and clean up `app/api/health/route.ts`.
   - Write `docs/runbook.md`.

