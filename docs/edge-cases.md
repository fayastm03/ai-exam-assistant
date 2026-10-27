# Phase 6: Application Hardening & Edge Cases Audit

This document records the hardening audit across all 28 edge cases covering Exam & Timer, Access & Security Leaks, Classes, Input Validation & Limits, AI Resiliency, and UI Responsiveness.

---

## Edge Cases Audit & Test Matrix

| # | Category | Edge Case Description | Expected Result | Test Method & Evidence | Status |
| :- | :--- | :--- | :--- | :--- | :-: |
| **1** | Exam & Timer | Double submit (calling submit twice or in two tabs at the same moment) | Scores once and returns identical result idempotently | `POST /api/student/exams/[id]/submit` atomic update filter on `status = 'in_progress'` + existing attempt lookup | **PASS** |
| **2** | Exam & Timer | Submit after `deadline_at` | Accepted once with status `auto_submitted`, scored on saved answers | Verified in `lib/attempt-autosubmit.ts` and `submit/route.ts` | **PASS** |
| **3** | Exam & Timer | Save answer after `deadline_at` plus 10s grace period | Rejected with HTTP 400 error; no answer saved | `POST /api/student/exams/[id]/answers` checks `now > deadline + grace` and rejects | **PASS** |
| **4** | Exam & Timer | Browser closed mid-test | Attempt is auto-submitted and scored next time student or teacher reads it | Evaluated in `student/attempt`, `student/result`, `teacher/attempts/[id]`, and `teacher/results` | **PASS** |
| **5** | Exam & Timer | Two tabs open on the same attempt | Both display identical remaining time calculated from `deadline_at`; answers from either tab save | Verified via shared `deadline_at` and upsert on `(attempt_id, question_id)` | **PASS** |
| **6** | Exam & Timer | Expired login session mid-test | Student redirected to login with `?next=`, resumes attempt with all answers restored | Handled in `proxy.ts` and `attempt/route.ts` restoring answers | **PASS** |
| **7** | Exam & Timer | Start attempt twice at the same moment | Exactly one attempt created; unique constraint `attempts_exam_student_unique` handled gracefully | Catch error code `23505` in `start/route.ts` and return the single created attempt | **PASS** |
| **8** | Exam & Timer | Exam closed (`close_at` passed) while student is mid-test | `deadline_at` already capped to `close_at`; new starts rejected | Clamped at creation in `start/route.ts` | **PASS** |
| **9** | Access & Leaks | Student calls teacher routes, teacher calls student routes, logged-out calls any | HTTP 401 Unauthorized or HTTP 403 Forbidden | `lib/auth.ts` role guards + `tests/auth-guards.test.ts` (7 passing tests) | **PASS** |
| **10** | Access & Leaks | Student opens another student's attempt, result, or feedback | Refused; attempts scoped strictly to `auth.user.id` | Scoped via `.eq('student_id', auth.user.id)` in all student endpoints | **PASS** |
| **11** | Access & Leaks | Teacher opens another teacher's exam, class, members, or results | Refused with HTTP 403 Forbidden | Verified ownership checks across all teacher routes (`lib/auth.ts`) | **PASS** |
| **12** | Access & Leaks | Correct options and explanations before submission | Never returned before submission | `attempt/route.ts` explicitly omits `correct_option` and `explanation` | **PASS** |
| **13** | Access & Leaks | Unreleased feedback or AI drafts reach student | Refused; students only see `is_released: true` | `student/result/route.ts` filters by `.eq('is_released', true)` | **PASS** |
| **14** | Classes | Join rate limit (11th attempt in 15 minutes) | HTTP 429 `"Too many join attempts. Please try again later."` | Evaluated in `student/classes/join/route.ts` using `join_attempts` table | **PASS** |
| **15** | Classes | Non-approved student starts exam (even with id) | Refused with HTTP 403 Forbidden | Checked via `exam_classes` and `class_members` in `start/route.ts` | **PASS** |
| **16** | Classes | Removed student | Cannot start new exams; can finish active attempt and view old results | `start/route.ts` allows resume on existing attempts; blocks new starts | **PASS** |
| **17** | Classes | Rejected student re-joining | Rejected; no new request created | `resolveJoinStatus('rejected')` returns `action: 'rejected'` | **PASS** |
| **18** | Classes | Disabled or regenerated code | Returns identical generic error `"Invalid or disabled code"` without leaking existence | `student/classes/join/route.ts` returns identical error for missing/disabled | **PASS** |
| **19** | Classes | Student tampering with `class_members` or reading join code | Blocked by RLS and server API filters | Database RLS restricts to own rows; APIs omit `join_code` for students | **PASS** |
| **20** | Classes | Exam with 0 classes published | Rejected with HTTP 400 error | `teacher/exams/[id]/publish/route.ts` checks `exam_classes` count > 0 | **PASS** |
| **21** | Input & Limits | Input size limits (question, options, comment, paste, class name, file) | Returns clear HTTP 400 or HTTP 413 | Zod schemas enforce length limits; file upload enforces 10MB + allowed MIME | **PASS** |
| **22** | Input & Limits | Missing fields, wrong types, malformed JSON | Clear HTTP 400 with no stack traces | JSON parse try/catch blocks and `handleZodError` | **PASS** |
| **23** | Input & Limits | Error responses | Never leak stack traces, SQL, keys, or internal credentials | Standardized `jsonError` response format | **PASS** |
| **24** | AI | Gemini rate limit (429) or invalid JSON | Retry with exponential backoff, fallback message, exam remains usable | Exponential backoff retry in `lib/ai/provider.ts` | **PASS** |
| **25** | AI | AI service down or missing key | Exam builder, student taking, and results work without interruption | Core MCQ authoring and code-based scoring operate independently of AI | **PASS** |
| **26** | AI | Student pages and client bundles | No AI calls from student pages; API keys not imported in client code | Verified via search: AI providers confined to server routes | **PASS** |
| **27** | UI | Loading, empty, and error states; no double-clicks | Spinners, empty placeholders, error banners, buttons disabled while pending | Implemented across all teacher and student pages | **PASS** |
| **28** | UI | Timer screen network drop warning & retries | Real-time offline warning banner and automated retry loop for failed answers | Added `isOnline` tracking and auto-retry routine in `take/page.tsx` | **PASS** |
