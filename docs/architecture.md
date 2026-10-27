# System Architecture

The AI Exam Assistant is a full-stack, timed examination and classroom platform with code-based scoring and AI-assisted workflows.

---

## 1. System Overview (The Three Parts)

```
┌────────────────────────────────────────────────────────────────────────┐
│                          1. FRONTEND LAYER                             │
│  - Next.js 16 App Router (React 19, Tailwind CSS, Lucide Icons)        │
│  - Student Portal: /exams, /exams/[id]/take, /exams/[id]/result, /join │
│  - Teacher Studio: /teacher, /teacher/exams, /teacher/classes          │
│  - Auth Views: /login, /signup, /forgot-password, /reset-password      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON
┌───────────────────────────────────▼────────────────────────────────────┐
│                  2. SERVERLESS BACKEND & API LAYER                     │
│  - Next.js Route Handlers with Route Segments and Vercel maxDuration   │
│  - Shared Auth Guards: requireTeacher, requireStudent (Cookie/Bearer)  │
│  - Zod Request & Response Schemas with standardized error handling     │
│  - Core Scoring Engine: lib/scoring.ts (pure arithmetic, negative marks)│
│  - AI Provider Engine: lib/ai/provider.ts (Google GenAI, retry backoff) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ PostgreSQL / Service Role
┌───────────────────────────────────▼────────────────────────────────────┐
│                    3. DATABASE & AUTH LAYER (Supabase)                 │
│  - Supabase Auth: email/password with email confirmation enforcement   │
│  - PostgreSQL with Row Level Security (RLS) policies on every table    │
│  - Security-definer helper functions avoiding policy recursion         │
│  - Partial unique indexes ensuring race-condition safety               │
└────────────────────────────────────────────────────────────────────────┘
```

### Part 1: Frontend Client
Built with Next.js 16 (App Router) and React 19. It provides responsive, accessible interfaces for two distinct personas:
- **Teacher Studio**: Exam creation, question management (manual, bulk paste, paper import, AI generation, AI explanation), class management, join requests, results analytics, and feedback moderation.
- **Student Portal**: Class joining with 6-character codes, class dashboard, exam taking with server-synchronized timers, instant review with score breakdown, and personalized AI/teacher feedback.
- **Security Rule**: No client bundle or student page ever imports service-role keys or AI provider libraries (`import 'server-only'` enforced).

### Part 2: Backend & Serverless API
Stateless Next.js Route Handlers running on Node.js/Vercel serverless functions:
- **Authentication Guards**: Validates email confirmation (`email_confirmed_at`) and role (`teacher` or `student`) via browser cookie sessions or Bearer tokens.
- **Deterministic Scoring Engine (`lib/scoring.ts`)**: Code-based scoring calculates total marks, percentage, topic performance, and weak topics. AI is never permitted to calculate or alter scores.
- **AI Integration (`lib/ai/`)**: Integrates with the Google GenAI SDK. Features exponential backoff on HTTP 429, structured JSON extraction, and deterministic fallbacks. All AI routes export `maxDuration = 60`.

### Part 3: Database & Security (Supabase PostgreSQL)
- **Row-Level Security (RLS)** enabled on all tables.
- **Security Definer Functions**: `is_approved_member(class_id)` checks membership with a fixed `search_path`, preventing infinite policy recursion.
- **Partial Unique Indexes**: Prevent concurrency races on exam attempts, automated feedback, and join requests.

---

## 2. Database Tables & Schema

| Table | Primary Key | Description |
| :--- | :--- | :--- |
| `profiles` | `id (uuid -> auth.users)` | User profile with `name`, `email`, and `role` (`student` or `teacher`). Managed via trigger. |
| `classes` | `id (uuid)` | Classroom group owned by a teacher (`teacher_id`), with unique 6-character `join_code` and `join_enabled`. |
| `class_members` | `id (uuid)` | Student enrollment status (`pending`, `approved`, `rejected`, `removed`), unique per `(class_id, student_id)`. |
| `exams` | `id (uuid)` | Exam metadata (`title`, `duration_min`, `negative_marking`, `status`, `teacher_id`). |
| `exam_classes` | `(exam_id, class_id)` | Junction table mapping published exams to authorized classes. |
| `questions` | `id (uuid)` | MCQ item (`number`, `text`, `options`, `correct_option`, `marks`, `topic`, `explanation`, `source`). |
| `attempts` | `id (uuid)` | Student test session (`exam_id`, `student_id`, `started_at`, `deadline_at`, `submitted_at`, `status`, `score`). |
| `attempt_answers`| `id (uuid)` | Student's saved answers per question (`attempt_id`, `question_id`, `chosen_option`, `is_correct`). |
| `attempt_feedback`| `id (uuid)` | Overall and question feedback (`teacher_id`, `attempt_id`, `question_id`, `comment`, `source`, `released`). |
| `join_attempts` | `id (uuid)` | Sliding-window IP rate limiter tracking class join attempts (max 10 per 15 mins). |

---

## 3. API Routes by Role

### Public & Authentication Routes
- `GET /api/health` — Application health check and database connectivity probe.
- `GET /auth/callback` — Supabase Auth PKCE exchange, email confirmation, and role-based redirect.

### Student Routes (`/api/student/...`)
*Guarded: Must have an authenticated student session with confirmed email.*

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/student/classes` | List student's enrolled classes and application statuses. |
| `POST` | `/api/student/classes/join` | Request enrollment in a class using a 6-character join code. |
| `GET` | `/api/student/exams` | List available, upcoming, and completed exams for approved classes. |
| `GET` | `/api/student/exams/[id]` | Get exam details (pre-test lobby screen). |
| `POST`| `/api/student/exams/[id]/start` | Start or resume an exam attempt; sets `deadline_at`. |
| `GET` | `/api/student/exams/[id]/attempt`| Get active exam questions (omits `correct_option` and `explanation`). |
| `POST`| `/api/student/exams/[id]/answers`| Autosave an answer during the exam (enforces deadline + 10s grace). |
| `POST`| `/api/student/exams/[id]/submit` | Submit and immediately grade the attempt using `lib/scoring.ts`. |
| `GET` | `/api/student/exams/[id]/result` | Fetch detailed post-submission review, scores, and released teacher feedback. |
| `GET` | `/api/student/exams/[id]/ai-feedback`| Fetch or generate personal automated AI feedback (`ai_auto` or `auto_template`). |

### Teacher Routes (`/api/teacher/...`)
*Guarded: Must have an authenticated teacher session with confirmed email.*

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/teacher/classes` | List teacher's classes with approved/pending member counts. |
| `POST` | `/api/teacher/classes` | Create a new class with an auto-generated unique join code. |
| `GET` | `/api/teacher/classes/[id]` | Get class details and assigned exams. |
| `PATCH`| `/api/teacher/classes/[id]` | Update class name or toggle `join_enabled`. |
| `POST` | `/api/teacher/classes/[id]/regenerate-code` | Invalidate previous code and assign a new 6-character join code. |
| `GET` | `/api/teacher/classes/[id]/members` | List members of a class with optional status filter. |
| `PATCH`| `/api/teacher/classes/[id]/members/[memberId]` | Approve, reject, or remove a student from the class. |
| `GET` | `/api/teacher/exams` | List teacher's exams with attempt metrics. |
| `POST` | `/api/teacher/exams` | Create a draft exam. |
| `GET` | `/api/teacher/exams/[id]` | Fetch full exam details, questions, and assigned classes. |
| `PATCH`| `/api/teacher/exams/[id]` | Update exam settings (title, duration, negative marking). |
| `DELETE`| `/api/teacher/exams/[id]` | Delete a draft exam. |
| `POST` | `/api/teacher/exams/[id]/publish` | Publish exam (requires at least 1 question and 1 assigned class). |
| `GET` | `/api/teacher/exams/[id]/classes` | Fetch classes assigned to an exam. |
| `POST` | `/api/teacher/exams/[id]/classes` | Assign/unassign classes to an exam. |
| `GET` | `/api/teacher/exams/[id]/questions` | List questions for an exam. |
| `POST` | `/api/teacher/exams/[id]/questions` | Add a single question manually. |
| `PATCH`| `/api/teacher/exams/[id]/questions/[questionId]` | Edit a question's text, options, marks, or explanation. |
| `DELETE`| `/api/teacher/exams/[id]/questions/[questionId]` | Delete a question from an exam. |
| `POST` | `/api/teacher/questions/parse` | Parse a single raw text block into an MCQ format. |
| `POST` | `/api/teacher/parser/bulk-paste` | Bulk parse multiple pasted questions using heuristic parser. |
| `POST` | `/api/teacher/exams/[id]/import` | Upload PDF/image and extract MCQs via AI multimodal prompt (`maxDuration = 60`). |
| `POST` | `/api/teacher/exams/[id]/generate` | Generate MCQs from lecture notes/files via AI (`maxDuration = 60`). |
| `POST` | `/api/teacher/exams/[id]/explain` | Generate comprehensive explanations for draft questions (`maxDuration = 60`). |
| `GET` | `/api/teacher/exams/[id]/results` | View class performance matrix, accuracy per question, and student attempts. |
| `POST` | `/api/teacher/exams/[id]/bulk-ai-feedback` | Bulk generate student AI feedback in safe batches of 5 (`maxDuration = 60`). |
| `GET` | `/api/teacher/attempts/[attemptId]` | Review a student's graded attempt with answer breakdown. |
| `POST` | `/api/teacher/attempts/[attemptId]/suggest-feedback` | Generate an AI feedback suggestion for teacher review (`maxDuration = 60`). |
| `POST` | `/api/teacher/attempts/[attemptId]/feedback` | Save draft or release teacher overall and question comments. |
| `POST` | `/api/teacher/attempts/[attemptId]/ai-feedback` | Show/hide automated AI feedback or trigger regeneration (`maxDuration = 60`). |

