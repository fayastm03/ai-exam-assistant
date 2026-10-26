# Edge Case Handling and Security Hardening

This document outlines the resilience measures, edge case guards, and verification procedures implemented for the **AI Exam Assistant** (Phase 6).

---

## 1. Double Submit (Idempotent)

- **Scenario:** The student double-clicks "Submit Exam", their network retries the request, or multiple concurrent submissions are fired.
- **Implementation:**
  - In [`POST /api/student/exams/[id]/submit`](file:///Users/fayastm/ai-exam-assistant/app/api/student/exams/[id]/submit/route.ts#L60), if the attempt record already has `status === 'submitted'` or `'auto_submitted'`, the route does **not** recalculate score or throw an error.
  - It idempotently returns `{ ok: true, alreadySubmitted: true, score, status }`.
  - On the client side ([`app/exams/[id]/take/page.tsx`](file:///Users/fayastm/ai-exam-assistant/app/exams/[id]/take/page.tsx)), the submit buttons are immediately disabled upon submission, and receiving `alreadySubmitted: true` redirects seamlessly to the results page.
- **Verification:** Unit tested in [`tests/hardening-edge-cases.test.ts`](file:///Users/fayastm/ai-exam-assistant/tests/hardening-edge-cases.test.ts).
- **Manual Test Note:** Open an in-progress exam, submit it once. Immediately re-send a POST request with curl or double-click submit quickly. Confirm the second request returns `{ alreadySubmitted: true }` with status 200 and identical score.

---

## 2. Submit After Deadline

- **Scenario:** A student manually triggers submission after their deadline has elapsed (e.g. clock manipulation or lagging client).
- **Implementation:**
  - In [`POST /api/student/exams/[id]/submit`](file:///Users/fayastm/ai-exam-assistant/app/api/student/exams/[id]/submit/route.ts#L98), the server checks `now.getTime() > new Date(attempt.deadline_at).getTime()`.
  - If the deadline has elapsed, the status is strictly set to `'auto_submitted'` regardless of client input.
- **Verification:** Unit tested in [`tests/hardening-edge-cases.test.ts`](file:///Users/fayastm/ai-exam-assistant/tests/hardening-edge-cases.test.ts).
- **Manual Test Note:** Modify the attempt deadline in the database to 1 minute in the past, then click Submit. Verify the attempt status is recorded as `auto_submitted`.

---

## 3. Answer After Deadline

- **Scenario:** A student attempts to select or change an answer after `deadline_at` has passed.
- **Implementation:**
  - In [`POST /api/student/exams/[id]/answers`](file:///Users/fayastm/ai-exam-assistant/app/api/student/exams/[id]/answers/route.ts#L54), the server checks the authoritative `deadline_at` on the attempt record (with a 10s grace window for inflight network packets).
  - If `now.getTime() > deadline.getTime() + gracePeriodMs`, the answer is rejected with `{ ok: false, expired: true }`.
  - In [`app/exams/[id]/take/page.tsx`](file:///Users/fayastm/ai-exam-assistant/app/exams/[id]/take/page.tsx#L248), receiving `expired: true` immediately triggers the client auto-submit flow.
- **Manual Test Note:** Wait until the countdown hits 00:00 (or set `deadline_at` in DB to past), attempt to click an option. The option is rejected and the exam automatically submits.

---

## 4. Browser Closed Mid-Test (Auto-Submit on Next Read)

- **Scenario:** The student closes their laptop, loses power, or closes the browser tab halfway through the exam and never clicks Submit before the timer expires.
- **Implementation:**
  - Handled by [`lib/attempt-autosubmit.ts`](file:///Users/fayastm/ai-exam-assistant/lib/attempt-autosubmit.ts) via `checkAndAutoSubmitIfExpired()`.
  - On the very next read of the attempt ([`GET /api/student/exams/[id]/attempt`](file:///Users/fayastm/ai-exam-assistant/app/api/student/exams/[id]/attempt/route.ts#L67)) or results ([`GET /api/student/exams/[id]/result`](file:///Users/fayastm/ai-exam-assistant/app/api/student/exams/[id]/result/route.ts#L52)), if `status === 'in_progress'` and `now > deadline_at`:
    1. All saved answers are scored using [`lib/scoring.ts`](file:///Users/fayastm/ai-exam-assistant/lib/scoring.ts).
    2. Attempt status is updated to `'auto_submitted'` and the calculated score is persisted.
    3. `is_correct` flags are updated on all answers.
    4. The student is redirected directly to their evaluated results page.
- **Verification:** Unit tested in [`tests/hardening-edge-cases.test.ts`](file:///Users/fayastm/ai-exam-assistant/tests/hardening-edge-cases.test.ts).
- **Manual Test Note:** Start an exam, answer 1 question, close the browser window. Wait until `deadline_at` passes. Re-open `/exams/[id]/take`. Observe immediate redirection to `/exams/[id]/result` with the verified score.

---

## 5. Two Tabs Open

- **Scenario:** The student opens the exam in two tabs simultaneously.
- **Implementation:**
  - **Shared Database State:** Both tabs point to the same database attempt record (enforced by the unique SQL constraint on `(exam_id, student_id)`). Answers in either tab save to the same record.
  - **Submission Synchronization:** When Tab A submits, it sets `localStorage.setItem('exam_submitted_' + examId, ...)`.
  - Tab B listens to `window.addEventListener('storage', ...)` in [`app/exams/[id]/take/page.tsx`](file:///Users/fayastm/ai-exam-assistant/app/exams/[id]/take/page.tsx#L205) and immediately navigates to `/exams/[id]/result`.
  - If Tab B tries to save an answer after Tab A submitted, [`POST /api/student/exams/[id]/answers`](file:///Users/fayastm/ai-exam-assistant/app/api/student/exams/[id]/answers/route.ts#L47) returns `{ ok: false, alreadySubmitted: true }`, which also triggers immediate redirect.
- **Manual Test Note:** Open `/exams/[id]/take` in two browser tabs. Click "Submit" in Tab 1. Watch Tab 2 immediately redirect to the results page.

---

## 6. Expired Login Session

- **Scenario:** The student or teacher's Supabase auth session token expires while navigating or submitting data.
- **Implementation:**
  - **API Routes:** [`lib/auth.ts`](file:///Users/fayastm/ai-exam-assistant/lib/auth.ts#L84) detects invalid/missing session cookies or expired Bearer tokens and returns HTTP 401 with `{ error: 'Unauthorized', message: 'Valid authentication credentials required' }`.
  - **Layouts:** [`app/teacher/layout.tsx`](file:///Users/fayastm/ai-exam-assistant/app/teacher/layout.tsx) and [`app/exams/layout.tsx`](file:///Users/fayastm/ai-exam-assistant/app/exams/layout.tsx) redirect unauthenticated users to `/login?error=auth_required` or `/login?error=session_expired`.
  - **Login Screen:** [`app/login/page.tsx`](file:///Users/fayastm/ai-exam-assistant/app/login/page.tsx#L32) displays a clear banner: *"Your session has expired. Please sign in again."*
- **Manual Test Note:** Delete the Supabase auth cookies in Chrome DevTools (`Application > Cookies`). Click any action or refresh. Observe automatic redirection to `/login` with the session expired message.

---

## 7. Role Violation & Accessing Other Students' Attempts

- **Scenario A (Student tries to open Teacher Route):**
  - Teacher layout checks `profile.role === 'teacher'`. If not, redirects to `/exams?error=teacher_required`.
  - All teacher API endpoints check `requireTeacher()`. If not teacher, returns HTTP 403 Forbidden.
- **Scenario B (Teacher tries to open Student Route):**
  - Student layout checks `profile.role === 'student'`. If not, redirects to `/teacher/exams?error=student_required`.
  - Student API endpoints check `requireStudent()`. If not student, returns HTTP 403 Forbidden.
- **Scenario C (Student tries to view another student's attempt/result):**
  - [`GET /api/student/exams/[id]/attempt`](file:///Users/fayastm/ai-exam-assistant/app/api/student/exams/[id]/attempt/route.ts#L60) and [`GET /api/student/exams/[id]/result`](file:///Users/fayastm/ai-exam-assistant/app/api/student/exams/[id]/result/route.ts#L43) query `.eq('student_id', auth.user.id)`. A student can **never** query or see another student's attempt.
  - Teacher attempt route [`/api/teacher/attempts/[attemptId]`](file:///Users/fayastm/ai-exam-assistant/app/api/teacher/attempts/[attemptId]/route.ts#L65) verifies `exam.teacher_id === auth.user.id`. Teachers can only view attempts for their own exams.
- **Manual Test Note:** Log in as Student B and try to request `/api/student/exams/[id]/result` for an exam only taken by Student A. The API returns 404 No Attempt Found.

---

## 8. Oversized Uploads and Long Text Limits

- **Scenario:** Uploading files larger than 10MB or pasting huge text strings to cause memory exhaustion.
- **Implementation:**
  - **Paper Import & Generator Uploads:** Strictly limited to 10MB (`MAX_FILE_SIZE = 10 * 1024 * 1024`). Files exceeding 10MB or invalid MIME types are rejected with HTTP 400.
  - **Pasted Notes for AI Generation:** Bounded to 50,000 characters by `generateFromNotesInputSchema`.
  - **Bulk Question Paste:** Bounded to 100,000 characters by `bulkParseSchema`.
  - **Question Text:** Bounded to 10,000 characters by `questionCreateSchema` and `questionUpdateSchema`.
  - **Option Text:** Bounded to 2,000 characters by `optionItemSchema`.
  - **Topic Name:** Bounded to 255 characters.
  - **Teacher Feedback Comment:** Bounded to 1,000 characters by `feedbackSaveSchema`.
- **Verification:** Unit tested in [`tests/hardening-edge-cases.test.ts`](file:///Users/fayastm/ai-exam-assistant/tests/hardening-edge-cases.test.ts).
- **Manual Test Note:** Attempt to submit a question with 15,000 characters. Zod validation fails with `Question text cannot exceed 10,000 characters`.

---

## 9. AI Rate-Limit Handling

- **Scenario:** Gemini API returns HTTP 429 Too Many Requests or resource exhaustion.
- **Implementation:**
  - In [`lib/ai/provider.ts`](file:///Users/fayastm/ai-exam-assistant/lib/ai/provider.ts#L121), `GeminiProvider` detects rate limit errors (`429`, `resource_exhausted`, `quota`).
  - Performs **3 automatic retries with exponential backoff and jitter** ($1.5\text{s} \times 2^{\text{attempt}} + \text{jitter}$).
  - If rate limits persist after all retries, routes return HTTP 429 with:
    `"AI service is currently rate limited. Please wait a moment and try again."`
  - All UI tabs ([`components/teacher/generate-notes-tab.tsx`](file:///Users/fayastm/ai-exam-assistant/components/teacher/generate-notes-tab.tsx#L162), [`app/teacher/exams/[id]/page.tsx`](file:///Users/fayastm/ai-exam-assistant/app/teacher/exams/[id]/page.tsx#L268), [`components/teacher/attempt-feedback-dialog.tsx`](file:///Users/fayastm/ai-exam-assistant/components/teacher/attempt-feedback-dialog.tsx#L173)) catch HTTP 429 and show an amber alert advising the teacher to wait 30 seconds before retrying.
- **Verification:** Unit tested in [`tests/ai-provider.test.ts`](file:///Users/fayastm/ai-exam-assistant/tests/ai-provider.test.ts).

---

## 10. Empty States and Loading States on Every Page

- **Teacher Dashboard ([`app/teacher/exams/page.tsx`](file:///Users/fayastm/ai-exam-assistant/app/teacher/exams/page.tsx)):**
  - Loading: 3 animated skeleton cards.
  - Empty: "No exams created yet" banner with "Create Your First Exam" button.
- **Exam Builder ([`app/teacher/exams/[id]/page.tsx`](file:///Users/fayastm/ai-exam-assistant/app/teacher/exams/[id]/page.tsx)):**
  - Loading: Centered spinner with "Loading exam details...".
  - Empty: "No questions added yet" card with "Add Question Manually" and "Bulk Paste" buttons.
- **Teacher Results Table ([`app/teacher/exams/[id]/results/page.tsx`](file:///Users/fayastm/ai-exam-assistant/app/teacher/exams/[id]/results/page.tsx)):**
  - Loading: Skeleton table and metric cards.
  - Empty: "No student submissions yet" with clear explanation and refresh button.
- **Student Exam List ([`app/exams/page.tsx`](file:///Users/fayastm/ai-exam-assistant/app/exams/page.tsx)):**
  - Loading: 3 animated skeleton cards.
  - Empty: "No active exams" with refresh button.
- **Student Exam Instructions ([`app/exams/[id]/page.tsx`](file:///Users/fayastm/ai-exam-assistant/app/exams/[id]/page.tsx)):**
  - Loading: Centered spinner.
  - Completed state: Shows score, completion badge, and link to results.
- **Student Test Screen ([`app/exams/[id]/take/page.tsx`](file:///Users/fayastm/ai-exam-assistant/app/exams/[id]/take/page.tsx)):**
  - Loading: "Connecting to exam session...".
  - Auto-submitting overlay: "Time Expired — Submitting Exam".
- **Student Result Page ([`app/exams/[id]/result/page.tsx`](file:///Users/fayastm/ai-exam-assistant/app/exams/[id]/result/page.tsx)):**
  - Loading: "Evaluating results...".
  - Feedback card: Automatically hides if no released feedback exists yet.
