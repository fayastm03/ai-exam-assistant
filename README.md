# AI Exam Assistant

An intelligent, timed Multiple-Choice Question (MCQ) examination and classroom platform built with Next.js, TypeScript, Tailwind CSS, Supabase, and Google Gemini AI.

---

## Class Workflow

1. **Teacher creates a class** with an auto-generated 6-character join code.
2. **Teacher shares the code or invite link** (`<site>/join?code=...`) with students.
3. **Student submits the code** to request enrollment in the class.
4. **Teacher reviews pending requests** and approves or rejects the student.
5. **Student sees class exams** and can take any published exam assigned to that class.

---

## Environment Variables

Copy `.env.example` to `.env.local` and configure the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-secret-key>

# Site URL Configuration (Used for invite links & auth callback redirects)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Seed Script Credentials
SEED_PASSWORD=YourSecureDemoPassword123

# AI Provider Configuration (Google Gemini)
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=<your-gemini-api-key>
```

### Supabase URL & SMTP Configuration
1. **Supabase Site URL & Redirects**:
   In your Supabase project dashboard under **Authentication -> URL Configuration**:
   - Set **Site URL** to `http://localhost:3000` (or your production deployment URL).
   - Add `http://localhost:3000/**` and `http://localhost:3000/auth/callback` to **Redirect URLs**.
2. **SMTP Settings (Production Emails)**:
   By default, Supabase applies rate limits on its built-in email service (3 emails per hour). For production or multi-user testing:
   - Navigate to **Authentication -> SMTP Settings** in the Supabase Dashboard.
   - Enable **Custom SMTP** and input your provider credentials (e.g. Resend, SendGrid, Mailgun, or AWS SES).

---

## Database Seeding

The project includes an idempotent seed script that provisions ready-to-test teacher and student accounts, a demo class with a fixed join code, and a published 10-question exam.

```bash
# Run database seed (reads SEED_PASSWORD from .env.local or environment)
npm run seed
```

> **Note:** The seed script is completely idempotent and can be safely re-run at any time without duplicate key conflicts or errors.

### Demo Accounts Provisioned by Seed:
- **Demo Class Name:** `Demo Class`
- **Fixed Join Code:** `DEMO26`
- **Invite Link:** `http://localhost:3000/join?code=DEMO26`
- **Demo Exam:** `Demo Examination` (10 MCQ questions, Published, Assigned to Demo Class)
- **Password:** As configured in `SEED_PASSWORD`
- **Accounts:**
  - `teacher@demo.com` (Role: Teacher — full console access)
  - `student.approved@demo.com` (Role: Student — approved member of Demo Class)
  - `student.pending@demo.com` (Role: Student — pending request in Demo Class)
  - `student.new@demo.com` (Role: Student — not enrolled in any class; ready to test `/join`)

---

## Running the Application & Tests

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### Unit & Integration Tests (Vitest)
```bash
# Run all 84 automated unit and integration tests
npm test
```

### Code Quality & Production Build
```bash
# Check TypeScript and ESLint rules
npm run lint

# Compile optimized production build
npm run build
```

---

## Manual Test Checklist

For a comprehensive tick-list of every test across API routes, Teacher UI, and Student UI, refer to:
- [`docs/classes-test-checklist.md`](docs/classes-test-checklist.md)
