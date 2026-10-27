# AI Exam Assistant

An intelligent, full-stack examination and classroom platform built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS**, **Supabase (PostgreSQL & Auth)**, and **Google Gemini AI**.

---

## Features

- **Teacher Exam Studio**: Rich exam builder supporting question banks, per-question marks, negative marking, topics, and draft/published states.
- **Classroom Enrollment & Join Codes**: Teachers create classes with unique 6-character non-ambiguous join codes. Students request access via code or invite link (`/join?code=...`); teachers approve or reject members.
- **Synchronized Timed Exams**: Server-authoritative timer capped at deadline, real-time autosave, double-submit protection, and auto-submit on expiry.
- **Code-Based Deterministic Scoring**: Pure algorithmic scoring (`lib/scoring.ts`) with negative marking and topic breakdown. Scores are calculated by the system, never by AI.
- **AI-Powered Authoring**:
  - *Paper Import*: Multimodal extraction of MCQs from scanned exam papers, PDFs, or photos.
  - *Question Generator*: Generates tailored questions from lecture notes or study materials.
  - *Explanation Generator*: Drafts detailed pedagogical explanations for questions.
- **Automated & Teacher Feedback**:
  - *Student Automated AI Feedback*: Immediate post-test analysis with deterministic fallback templates if AI is rate-limited.
  - *Teacher Review Popup*: Review student answers, suggest feedback with AI, save drafts, and release comments.
  - *Bulk AI Generation*: Generates feedback across all submitted students in rate-limit-safe batches.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Actions, Partial Prerendering, Turbopack)
- **UI & Styling**: React 19, Tailwind CSS, Lucide Icons, Shadcn UI primitives
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS) & Supabase Auth
- **AI Engine**: Google GenAI SDK (`@google/genai`) with exponential backoff retry loop
- **Validation & Testing**: Zod, Vitest (98 unit & integration tests)

---

## Prerequisites

- **Node.js**: v18.18+ or v20+
- **npm**: v9+
- **Supabase Account**: Free project on [supabase.com](https://supabase.com)
- **Google AI Studio Key**: Free API key from [aistudio.google.com](https://aistudio.google.com)

---

## 15-Minute Setup Guide

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/ai-exam-assistant.git
cd ai-exam-assistant
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in the values in `.env.local`:

```env
# Supabase Configuration
# Found in: Supabase Dashboard -> Project Settings -> API
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-secret-key>

# Application URL
# Local development URL (or your production Vercel domain)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# AI Provider Configuration (Google Gemini)
# Obtain from: https://aistudio.google.com
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=<your-gemini-api-key>

# Seed Script Credentials (used by npm run seed)
SEED_PASSWORD=YourSecureDemoPassword123!
```

| Variable | Where to Find It |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard -> **Project Settings** -> **API** -> Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard -> **Project Settings** -> **API** -> `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard -> **Project Settings** -> **API** -> `service_role` secret key |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally, or `https://<your-app>.vercel.app` on Vercel |
| `AI_PROVIDER` | Set to `gemini` |
| `GEMINI_MODEL` | `gemini-2.5-flash` (recommended stable) or `gemini-3-flash-preview` |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com) -> **Get API key** |
| `SEED_PASSWORD` | Any strong password of your choice for demo accounts |

### 3. Supabase Database Migrations

Open the **SQL Editor** in your Supabase Dashboard and run the migrations in order:

1. `supabase/migrations/20261026151500_init_exam_assistant_schema.sql` (Core tables, indexes, triggers, RLS)
2. `supabase/migrations/20261026233000_harden_handle_new_user_student_only.sql` (Security hardening: signup always creates student role)
3. `supabase/migrations/20261026234500_classes_schema_rls_backfill.sql` (Classes, members, exam_classes, is_approved_member function)
4. `supabase/migrations/20261027000500_join_attempts_ratelimit.sql` (Join code rate-limiting table and index)
5. `supabase/migrations/20261027120000_automatic_ai_feedback.sql` (Automatic feedback sources and unique index)

### 4. Supabase Authentication Settings

In your Supabase Dashboard under **Authentication**:

1. **Email Provider**:
   - Navigate to **Authentication** -> **Providers** -> **Email**.
   - Ensure **Enable Email provider** is **ON**.
   - Ensure **Confirm email** is **ON** (unconfirmed emails are rejected by app auth guards).
2. **URL Configuration**:
   - Navigate to **Authentication** -> **URL Configuration**.
   - Set **Site URL** to `http://localhost:3000` (or your production Vercel domain).
   - Add the following to **Redirect URLs**:
     - `http://localhost:3000/**`
     - `http://localhost:3000/auth/callback`
3. **SMTP Settings (Optional for Local Dev, Required for Production)**:
   - By default, Supabase's built-in email service limits emails to 3 per hour.
   - For production, navigate to **Authentication** -> **SMTP Settings**, enable **Custom SMTP**, and provide credentials (e.g. Resend, SendGrid, Mailgun).

### 5. Seed the Database

Run the idempotent seed script to create ready-to-use teacher, student, class, and exam data:

```bash
npm run seed
```

### 6. Run the Application

```bash
# Start local development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## Demo Accounts

Provisioned automatically by `npm run seed`:

- **Password for all accounts**: Defined in your `SEED_PASSWORD` environment variable.
- **Fixed Demo Class Join Code**: `DEMO26` (Invite link: `http://localhost:3000/join?code=DEMO26`)

| Role | Email | Description |
| :--- | :--- | :--- |
| **Teacher** | `teacher@demo.com` | Full teacher dashboard, owns `Demo Class` and `Demo Examination` |
| **Student (Approved)** | `student.approved@demo.com` | Approved member of Demo Class; can take the published exam |
| **Student (Pending)** | `student.pending@demo.com` | Pending enrollment in Demo Class; shows "Waiting for teacher approval" |
| **Student (New)** | `student.new@demo.com` | Unenrolled student; ready to test the `/join` page with a code |

---

## Running Tests & Code Quality

```bash
# Run unit and integration test suite (98 tests across scoring, auth, AI, edge cases)
npm test

# Run TypeScript and Next.js production build check
npm run build
```

---

## Deployment to Vercel

1. **Push your code** to GitHub.
2. **Import project** into [Vercel](https://vercel.com).
3. **Set Environment Variables** in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (set to your Vercel deployment URL, e.g. `https://your-app.vercel.app`)
   - `AI_PROVIDER=gemini`
   - `GEMINI_MODEL=gemini-2.5-flash`
   - `GEMINI_API_KEY`
   - `SEED_PASSWORD`
4. **Update Supabase URL Settings**:
   - In Supabase -> **Authentication** -> **URL Configuration**:
   - Update **Site URL** to `https://your-app.vercel.app`.
   - Add `https://your-app.vercel.app/**` and `https://your-app.vercel.app/auth/callback` to **Redirect URLs**.
5. **Deploy**:
   - Trigger deployment. All AI routes are preconfigured with `maxDuration = 60` for serverless execution.

---

## Known Limits & Architectural Notes

- **Vercel Serverless Function Timeout**: Serverless routes on Vercel Hobby tier have a maximum execution duration of 60 seconds (`maxDuration = 60`). AI operations (bulk feedback, question extraction) are batched in groups of 5 to guarantee completion well within 60 seconds.
- **Request Body Size Limit**: Vercel enforces a 4.5MB request payload limit on serverless functions. Document and paper uploads are capped at **4MB** with explicit client- and server-side validation.
- **Google Gemini Free Tier Rate Limits**: The Gemini free tier has a rate limit of 15 requests per minute (RPM). The application implements automatic exponential backoff retries in `lib/ai/provider.ts` and falls back to deterministic code-generated templates (`auto_template`) if limits are exhausted.
- **Model Compatibility**: Tested on `gemini-2.5-flash` and `gemini-3-flash-preview`. When configuring `GEMINI_MODEL`, ensure the model supports structured JSON response mode (`responseMimeType: 'application/json'`).
