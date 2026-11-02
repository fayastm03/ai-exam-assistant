# Operations & Deployment Runbook

## 1. Application Architecture & Stack
- **Framework**: Next.js 16 (App Router with Partial Prerendering & Cache Components)
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security, SSR Cookies)
- **AI Engine**: Google Gemini (Server-side SDK `@google/genai` with schema validation)
- **Deployment Platform**: Vercel

---

## 2. Deploying to Production
1. **GitHub CI Pipeline**:
   - Every push to `main` executes `.github/workflows/ci.yml` (ESLint, TypeScript check, Vitest unit tests, and Next.js production build).
2. **Vercel Automatic Deployment**:
   - Merges to `main` trigger an automated Vercel production build.
3. **Environment Variables**:
   Ensure the following production environment variables are configured in the Vercel Dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL (`https://<project-ref>.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase project anon/public API key
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase server-only service role secret key
   - `NEXT_PUBLIC_SITE_URL`: Canonical production origin (`https://exam-assistant-ai.vercel.app`)
   - `GEMINI_API_KEY`: Server-only Google Gemini API key
   - `AI_PROVIDER`: `gemini`
   - `GEMINI_MODEL`: e.g. `gemini-2.5-flash`

---

## 3. Teacher Account Provisioning
To maintain strict privilege isolation, **teacher accounts cannot be created via public sign-up or API request bodies**.
The database trigger `handle_new_user()` defaults every newly created account to `student`.

### Provisioning Steps:
1. Have the educator sign up normally at `/signup` with their institutional email address.
2. Confirm their email address (either via confirmation email or Supabase Auth Dashboard).
3. In the Supabase SQL Editor, promote the user to `teacher`:
   ```sql
   UPDATE public.profiles
   SET role = 'teacher', updated_at = NOW()
   WHERE id = (
     SELECT id FROM auth.users WHERE email = 'teacher@school.edu'
   );
   ```
4. The educator can now access `/teacher/exams` and `/teacher/classes`.

---

## 4. Key Rotation Runbook
If any API secret is suspected of compromise:
1. **Supabase Service Role Key**:
   - Go to Supabase Dashboard -> **Project Settings** -> **API**.
   - Click **Generate new secret key**.
   - Immediately update `SUPABASE_SERVICE_ROLE_KEY` in Vercel Project Settings and trigger a redeployment.
2. **Google Gemini API Key**:
   - Open Google AI Studio / Google Cloud Console -> **API Keys**.
   - Create a new API key.
   - Update `GEMINI_API_KEY` in Vercel and redeploy.
   - Delete the old key in Google Cloud Console.

---

## 5. Rollback Procedure
If a production defect is observed post-deployment:
1. In the Vercel Dashboard -> **Deployments**, locate the last known healthy deployment.
2. Click the three dots `...` and select **Promote to Production** (instant zero-downtime rollback).
3. In git, revert the offending commit:
   ```bash
   git revert <commit-sha>
   git push origin main
   ```

---

## 6. Database Backups & Point-in-Time Recovery
- Supabase automatically maintains daily database backups.
- For enterprise disaster recovery, enable **Point in Time Recovery (PITR)** in Supabase Dashboard -> **Database** -> **Backups**.
- Before applying any new manual SQL migration, take an on-demand snapshot:
  ```bash
  supabase db dump -f pre_migration_backup.sql
  ```
