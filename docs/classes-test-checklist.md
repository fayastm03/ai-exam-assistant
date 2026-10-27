# Classes Feature Verification & Manual Test Checklist

This checklist documents the end-to-end verification tests across **Step C (API routes)**, **Step D (Teacher UI)**, and **Step E (Student UI)**.

---

## 1. Quick Setup for Testing

Before running manual tests, ensure the local environment is prepared:
```bash
# 1. Apply database migrations in Supabase Dashboard SQL Editor:
#    - supabase/migrations/20261026234500_classes_schema_rls_backfill.sql
#    - supabase/migrations/20261027000500_join_attempts_ratelimit.sql

# 2. Run idempotent database seed:
npm run seed
```

**Seed Credentials (Password configured in `SEED_PASSWORD`):**
- **Teacher:** `teacher@demo.com`
- **Approved Student:** `student.approved@demo.com` (enrolled in "Demo Class")
- **Pending Student:** `student.pending@demo.com` (waiting for approval in "Demo Class")
- **New Student:** `student.new@demo.com` (not enrolled in any class)
- **Demo Class Join Code:** `DEMO26`

---

## 2. Step C: API Routes & Validations

### Teacher API Tests
- [ ] **TC-API-01: Create Class**
  - **Action:** `POST /api/teacher/classes` with `{ "name": "Computer Science 101" }`.
  - **Expected Result:** HTTP 200/201; returns class object with unique 6-character `join_code` (excluding `0`, `O`, `1`, `I`), `join_enabled: true`, `approved_count: 0`, `pending_count: 0`.
- [ ] **TC-API-02: List Teacher Classes**
  - **Action:** `GET /api/teacher/classes`.
  - **Expected Result:** HTTP 200; returns array of classes owned exclusively by the authenticated teacher with accurate counts of `approved_count` and `pending_count`.
- [ ] **TC-API-03: Update Class Name & Joining Switch**
  - **Action:** `PATCH /api/teacher/classes/<id>` with `{ "name": "CS 101 - Advanced", "join_enabled": false }`.
  - **Expected Result:** HTTP 200; class name updated; `join_enabled` is set to `false`.
- [ ] **TC-API-04: Regenerate Join Code**
  - **Action:** `POST /api/teacher/classes/<id>/regenerate-code`.
  - **Expected Result:** HTTP 200; generates a brand new 6-character code; previous code becomes invalid immediately.
- [ ] **TC-API-05: List Class Members with Status Filter**
  - **Action:** `GET /api/teacher/classes/<id>/members?status=pending` (or `approved`, `rejected`, `removed`, `all`).
  - **Expected Result:** HTTP 200; returns member array containing student `name`, `email`, `status`, `requested_at`, and `decided_at`.
- [ ] **TC-API-06: Approve Member**
  - **Action:** `PATCH /api/teacher/classes/<id>/members/<memberId>` with `{ "status": "approved" }`.
  - **Expected Result:** HTTP 200; member `status` transitions to `approved`, `decided_at` is updated to current timestamp.
- [ ] **TC-API-07: Reject Member**
  - **Action:** `PATCH /api/teacher/classes/<id>/members/<memberId>` with `{ "status": "rejected" }`.
  - **Expected Result:** HTTP 200; member `status` transitions to `rejected`, `decided_at` is updated.
- [ ] **TC-API-08: Remove Member**
  - **Action:** `PATCH /api/teacher/classes/<id>/members/<memberId>` with `{ "status": "removed" }`.
  - **Expected Result:** HTTP 200; member `status` transitions to `removed`.
- [ ] **TC-API-09: Assign Exam to Classes**
  - **Action:** `PUT /api/teacher/exams/<id>/classes` with `{ "class_ids": ["<class-id-1>", "<class-id-2>"] }`.
  - **Expected Result:** HTTP 200; updates `exam_classes` junction table; teacher can assign only to classes they own.
- [ ] **TC-API-10: Exam Publish Validation (Zero Classes)**
  - **Action:** `POST /api/teacher/exams/<id>/publish` on an exam with 0 assigned classes.
  - **Expected Result:** HTTP 400; returns error message indicating the exam must be assigned to at least one class before publishing.
- [ ] **TC-API-11: Teacher Results Class Filter**
  - **Action:** `GET /api/teacher/exams/<id>/results?class_id=<class-id>`.
  - **Expected Result:** HTTP 200; filters returned attempts strictly to students in the specified class.

### Student API Tests
- [ ] **TC-API-12: Join Class (First-Time Request)**
  - **Action:** `POST /api/student/classes/join` with `{ "code": "demo26" }`.
  - **Expected Result:** HTTP 200; code is normalised (trimmed, uppercase); status returned is `pending`; `class_members` row created.
- [ ] **TC-API-13: Join Class (Already Pending)**
  - **Action:** Submit join request again for an already `pending` class.
  - **Expected Result:** HTTP 200; returns status `pending` with message `"Your join request is already pending approval"`; no duplicate row created.
- [ ] **TC-API-14: Join Class (Already Approved)**
  - **Action:** Submit join request for a class where student is already `approved`.
  - **Expected Result:** HTTP 200; returns status `approved` with message `"You are an approved member of this class"`.
- [ ] **TC-API-15: Join Class (Rejected)**
  - **Action:** Submit join request for a class where student was `rejected`.
  - **Expected Result:** HTTP 200; returns status `rejected` with message `"Your join request for this class was previously rejected"`; no new request created.
- [ ] **TC-API-16: Join Class (Removed)**
  - **Action:** Submit join request for a class from which student was `removed`.
  - **Expected Result:** HTTP 200; resets status back to `pending`; updates `requested_at` and clears `decided_at`.
- [ ] **TC-API-17: Join Class (Invalid Code)**
  - **Action:** `POST /api/student/classes/join` with `{ "code": "NONEX9" }`.
  - **Expected Result:** HTTP 400; generic error `"Invalid or disabled code"`.
- [ ] **TC-API-18: Join Class (Disabled Code)**
  - **Action:** `POST /api/student/classes/join` with code of a class where `join_enabled: false`.
  - **Expected Result:** HTTP 400; identical generic error `"Invalid or disabled code"`.
- [ ] **TC-API-19: Join Rate Limit Enforcement**
  - **Action:** Submit 11 join requests within 15 minutes from the same student user.
  - **Expected Result:** 11th attempt returns HTTP 429 `"Too many join attempts. Please try again later."`.
- [ ] **TC-API-20: Student Classes List**
  - **Action:** `GET /api/student/classes`.
  - **Expected Result:** HTTP 200; returns list of classes student belongs to; never exposes join codes, student rosters, or other student accounts.
- [ ] **TC-API-21: Student Exam List**
  - **Action:** `GET /api/student/exams`.
  - **Expected Result:** HTTP 200; returns only published exams assigned to classes where the student is `approved`.

---

## 3. Step D: Teacher UI Pages

- [ ] **TC-UI-T01: Teacher Navigation**
  - **Action:** Navigate through `/teacher/exams` and `/teacher/classes`.
  - **Expected Result:** Navbar shows "Exams" and "Classes" with active highlight; bottom mobile navigation bar works on mobile screen widths (< 640px).
- [ ] **TC-UI-T02: Classes Overview Page (`/teacher/classes`)**
  - **Action:** View classes list.
  - **Expected Result:** Displays each class with name, join code, approved members count, and pending requests count with an amber badge when pending > 0.
- [ ] **TC-UI-T03: Create Class Modal**
  - **Action:** Click "Create Class", enter class name, click submit.
  - **Expected Result:** Class created; unique join code generated; list updates immediately.
- [ ] **TC-UI-T04: Class Name Inline Editing**
  - **Action:** In `/teacher/classes/<id>`, edit class name and click Save.
  - **Expected Result:** Updates class title seamlessly without page reload.
- [ ] **TC-UI-T05: Copy Code & Copy Invite Link Buttons**
  - **Action:** Click "Copy code" and "Copy invite link".
  - **Expected Result:** "Copy code" copies 6-char code; "Copy invite link" copies `<NEXT_PUBLIC_SITE_URL>/join?code=CODE`. Toast or button text confirms copy.
- [ ] **TC-UI-T06: Join Enable/Disable Switch**
  - **Action:** Toggle the "Allow Joining" switch off.
  - **Expected Result:** Joining disabled; students attempting to use this code receive generic invalid/disabled code error.
- [ ] **TC-UI-T07: Regenerate Join Code**
  - **Action:** Click "Regenerate code", confirm in the dialog prompt.
  - **Expected Result:** Code updates; warning confirms previous code will no longer work.
- [ ] **TC-UI-T08: Pending Requests Review**
  - **Action:** Open "Pending requests" tab on a class with pending students.
  - **Expected Result:** Displays student name and email. Clicking "Approve" moves student to Members tab; clicking "Reject" sets status to rejected.
- [ ] **TC-UI-T09: Class Members Management**
  - **Action:** Open "Members" tab, filter by status, click "Remove" on an approved member.
  - **Expected Result:** Removal confirmation dialog appears; on confirm, student membership status is set to `removed`.
- [ ] **TC-UI-T10: Assigned Exams Section**
  - **Action:** View "Assigned Exams" card on class page.
  - **Expected Result:** Lists all exams currently assigned to this class with duration, questions count, and status.
- [ ] **TC-UI-T11: Exam Settings - Classes Multi-Select**
  - **Action:** On `/teacher/exams/<id>`, locate "Classes" multi-select dropdown.
  - **Expected Result:** Teacher can select one or multiple classes; changes save via `PUT /api/teacher/exams/<id>/classes`.
- [ ] **TC-UI-T12: Exam Publish Guard (0 Classes Selected)**
  - **Action:** Deselect all classes on an exam and click "Publish".
  - **Expected Result:** Modal/alert appears stating that an exam must be assigned to at least one class before publishing; publishing blocked.
- [ ] **TC-UI-T13: Teacher Results Class Filter**
  - **Action:** On `/teacher/exams/<id>/results`, select a class from the class dropdown filter.
  - **Expected Result:** Results table updates to display only candidate submissions belonging to that class.

---

## 4. Step E: Student UI Pages

- [ ] **TC-UI-S01: Student Navigation**
  - **Action:** Log in as student, view top navbar.
  - **Expected Result:** Displays "Exams", "My classes", and "Join a class" links with active styling and mobile navigation bar.
- [ ] **TC-UI-S02: Join Page Pre-fill from URL (`/join?code=...`)**
  - **Action:** Visit `/join?code=demo26`.
  - **Expected Result:** Code input is automatically filled with `DEMO26` (trimmed and uppercase).
- [ ] **TC-UI-S03: Join Code Preservation Across Authentication**
  - **Action:** Log out. Visit `/join?code=DEMO26`.
  - **Expected Result:** Redirects to `/login?next=%2Fjoin%3Fcode%3DDEMO26`. After signing in or signing up and confirming email, user lands back on `/join` with `DEMO26` pre-filled.
- [ ] **TC-UI-S04: Join Feedback - Request Sent**
  - **Action:** Log in as `student.new@demo.com`. Submit join code `DEMO26`.
  - **Expected Result:** Displays card: *"Request sent, waiting for your teacher to approve"* with a button to "View My Classes".
- [ ] **TC-UI-S05: Join Feedback - Already a Member**
  - **Action:** Log in as `student.approved@demo.com`. Submit code `DEMO26`.
  - **Expected Result:** Displays card: *"You are already a member"* with a button to "Browse Exams".
- [ ] **TC-UI-S06: Join Feedback - Request Pending**
  - **Action:** Log in as `student.pending@demo.com`. Submit code `DEMO26`.
  - **Expected Result:** Displays card: *"Your request is pending"* with waiting note.
- [ ] **TC-UI-S07: Join Feedback - Request Declined**
  - **Action:** Submit code for a class where the student's request was rejected.
  - **Expected Result:** Displays card: *"Your request was declined"*.
- [ ] **TC-UI-S08: Join Feedback - Invalid / Disabled Code**
  - **Action:** Submit an invalid or disabled code (e.g., `WRONG1`).
  - **Expected Result:** Displays alert: *"Invalid or disabled code. Please verify the 6-character code with your teacher."* Never reveals whether code exists.
- [ ] **TC-UI-S09: Join Feedback - Rate Limit (429)**
  - **Action:** Submit 11 codes within 15 minutes.
  - **Expected Result:** Displays alert: *"Too many join attempts. Please wait a few minutes before trying again."*
- [ ] **TC-UI-S10: My Classes Overview (`/classes`)**
  - **Action:** Log in as `student.approved@demo.com` and open `/classes`.
  - **Expected Result:** Lists "Demo Class" with **Approved** badge and count of available exams (`1 available exam`) with link to `/exams`.
- [ ] **TC-UI-S11: My Classes Status Badges & Notes**
  - **Action:** Log in as `student.pending@demo.com` and open `/classes`.
  - **Expected Result:** "Demo Class" shows **Pending** badge and note: *"Waiting for teacher approval"*.
- [ ] **TC-UI-S12: My Classes - Empty State**
  - **Action:** Log in as `student.new@demo.com` (prior to joining any class) and open `/classes`.
  - **Expected Result:** Friendly empty state: *"You haven't joined any classes yet"* with a prominent button to "Join a Class".
- [ ] **TC-UI-S13: Student Exam Dashboard - No Approved Classes Empty State**
  - **Action:** Log in as `student.new@demo.com` and open `/exams`.
  - **Expected Result:** Clean empty state: *"Join a class to access exams"* with CTA button linking to `/join`.
- [ ] **TC-UI-S14: Student Exam Dashboard - Class Name & Grouped Sections**
  - **Action:** Log in as `student.approved@demo.com` and open `/exams`.
  - **Expected Result:**
    - Displays "Demo Class" badge on "Demo Examination".
    - Grouped into sections: **Available Exams** (Start button active), **Upcoming Exams** (disabled, shows opening date/time), **Completed Exams** (shows score, link to result), **Closed Exams** (disabled).
- [ ] **TC-UI-S15: Exam Start Access Denial (403)**
  - **Action:** While student is on the exam instructions page (`/exams/<id>`), teacher removes student from class. Student clicks "Start Exam".
  - **Expected Result:** Page displays an inline alert: *"Access denied: You must be an approved member of a class assigned to this exam. Your membership may have been removed or is pending approval."* with buttons to "View My Classes" and "Back to Available Exams". The page does not crash or show an unhandled error screen.
