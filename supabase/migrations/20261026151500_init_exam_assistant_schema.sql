-- ==============================================================================
-- Migration: 20261026151500_init_exam_assistant_schema.sql
-- Description: Initial schema for AI Exam Assistant
-- Tables: profiles, exams, questions, attempts, attempt_answers, attempt_feedback
-- Security: Row Level Security (RLS) on all tables with explicit comments
-- Trigger: Automatic profile provisioning on auth.users signup
-- Order:
--   1. Extensions
--   2. Tables Definition
--   3. Foreign Key & Query Indexes
--   4. Helper Functions
--   5. Triggers
--   6. Row-Level Security (RLS) & Policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Extensions
-- ------------------------------------------------------------------------------

-- Enable standard UUID generation if not already enabled
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. Tables Definition
-- ------------------------------------------------------------------------------

-- 2.1 profiles: User profiles linked to Supabase auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'student' check (role in ('teacher', 'student')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.2 exams: Exam metadata authored by teachers
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  instructions text,
  duration_min integer not null check (duration_min > 0),
  open_at timestamptz,
  close_at timestamptz,
  negative_marking numeric not null default 0 check (negative_marking >= 0),
  shuffle boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_exam_dates check (close_at is null or open_at is null or close_at >= open_at)
);

-- 2.3 questions: Exam MCQ questions
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  number integer not null check (number > 0),
  text text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option text not null,
  marks numeric not null default 1 check (marks > 0),
  topic text,
  explanation text,
  source text not null default 'manual' check (source in ('manual', 'imported', 'generated')),
  review_status text not null default 'draft' check (review_status in ('draft', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_exam_id_number_unique unique (exam_id, number)
);

-- 2.4 attempts: Student exam sessions and deadlines
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  score numeric,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'auto_submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attempts_exam_student_unique unique (exam_id, student_id)
);

-- 2.5 attempt_answers: Student answers per question in an attempt
create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  chosen_option text,
  is_correct boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attempt_answers_attempt_question_unique unique (attempt_id, question_id)
);

-- 2.6 attempt_feedback: Teacher or AI feedback on attempts/questions
create table if not exists public.attempt_feedback (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  comment text not null,
  question_id uuid references public.questions(id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'ai_draft')),
  released boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 3. Indexes on Foreign Keys and High-Traffic Query Paths
-- ------------------------------------------------------------------------------

create index if not exists exams_teacher_id_idx on public.exams (teacher_id);
create index if not exists exams_status_idx on public.exams (status);

create index if not exists questions_exam_id_idx on public.questions (exam_id);

create index if not exists attempts_exam_id_idx on public.attempts (exam_id);
create index if not exists attempts_student_id_idx on public.attempts (student_id);
create index if not exists attempts_status_idx on public.attempts (status);

create index if not exists attempt_answers_attempt_id_idx on public.attempt_answers (attempt_id);
create index if not exists attempt_answers_question_id_idx on public.attempt_answers (question_id);

create index if not exists attempt_feedback_attempt_id_idx on public.attempt_feedback (attempt_id);
create index if not exists attempt_feedback_teacher_id_idx on public.attempt_feedback (teacher_id);
create index if not exists attempt_feedback_question_id_idx on public.attempt_feedback (question_id);
create index if not exists attempt_feedback_released_idx on public.attempt_feedback (released);

-- ------------------------------------------------------------------------------
-- 4. Helper Functions
-- ------------------------------------------------------------------------------

-- Generic updated_at timestamp refresher
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Helper to check if current authenticated user has the 'teacher' role.
-- Defined as SECURITY DEFINER with empty search_path to prevent recursion on profiles RLS.
create or replace function public.is_teacher()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'teacher'
  );
$$;

revoke execute on function public.is_teacher() from public;
grant execute on function public.is_teacher() to authenticated;

-- Function: Automatically create a profile row upon new auth.users signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role text;
  user_name text;
begin
  -- Validate role from metadata, default to 'student'
  if new.raw_user_meta_data->>'role' = 'teacher' then
    assigned_role := 'teacher';
  else
    assigned_role := 'student';
  end if;

  -- Determine display name with safe fallback
  user_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1),
    'User'
  );

  insert into public.profiles (id, name, role)
  values (new.id, user_name, assigned_role)
  on conflict (id) do update
  set
    name = coalesce(excluded.name, public.profiles.name),
    role = coalesce(public.profiles.role, excluded.role),
    updated_at = now();

  return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. Triggers
-- ------------------------------------------------------------------------------

-- updated_at triggers
create or replace trigger profiles_handle_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create or replace trigger exams_handle_updated_at
  before update on public.exams
  for each row execute function public.handle_updated_at();

create or replace trigger questions_handle_updated_at
  before update on public.questions
  for each row execute function public.handle_updated_at();

create or replace trigger attempts_handle_updated_at
  before update on public.attempts
  for each row execute function public.handle_updated_at();

create or replace trigger attempt_answers_handle_updated_at
  before update on public.attempt_answers
  for each row execute function public.handle_updated_at();

create or replace trigger attempt_feedback_handle_updated_at
  before update on public.attempt_feedback
  for each row execute function public.handle_updated_at();

-- Auth user trigger
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 6. Row-Level Security (RLS) & Policies
-- ------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.attempt_feedback enable row level security;

-- ==============================================================================
-- 6.1 profiles Policies
-- ==============================================================================

-- [Policy 1: profiles_select_own]
-- Allows any authenticated user to view their own profile.
create policy profiles_select_own on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- [Policy 2: profiles_select_teachers]
-- Allows verified teachers to view student profiles for administrative/grading context.
create policy profiles_select_teachers on public.profiles
  for select
  to authenticated
  using ((select public.is_teacher()));

-- [Policy 3: profiles_update_own]
-- Allows authenticated users to update their own display name, while strictly locking
-- their role so students cannot escalate their privileges to teacher.
create policy profiles_update_own on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and role = (select p.role from public.profiles p where p.id = (select auth.uid()))
  );

-- ==============================================================================
-- 6.2 exams Policies
-- ==============================================================================

-- [Policy 1: exams_teacher_select]
-- Allows teachers to view and manage only their own authored exams (draft, published, or closed).
create policy exams_teacher_select on public.exams
  for select
  to authenticated
  using ((select auth.uid()) = teacher_id);

-- [Policy 2: exams_student_select]
-- Allows students to discover and read only published exams. Draft and closed exams remain hidden.
create policy exams_student_select on public.exams
  for select
  to authenticated
  using (status = 'published');

-- [Policy 3: exams_teacher_insert]
-- Ensures only authenticated teachers can create new exams, setting themselves as teacher_id.
create policy exams_teacher_insert on public.exams
  for insert
  to authenticated
  with check (
    (select auth.uid()) = teacher_id
    and (select public.is_teacher())
  );

-- [Policy 4: exams_teacher_update]
-- Allows teachers to edit and publish only exams that they own.
create policy exams_teacher_update on public.exams
  for update
  to authenticated
  using ((select auth.uid()) = teacher_id)
  with check ((select auth.uid()) = teacher_id);

-- [Policy 5: exams_teacher_delete]
-- Allows teachers to delete only exams that they own.
create policy exams_teacher_delete on public.exams
  for delete
  to authenticated
  using ((select auth.uid()) = teacher_id);

-- ==============================================================================
-- 6.3 questions Policies
-- ==============================================================================
-- IMPORTANT SECURITY NOTE ON QUESTIONS:
-- As required by the system security design, students must NEVER read `correct_option`
-- or `explanation` directly before exam submission.
-- Because Postgres table RLS operates at the row level, giving students SELECT access on
-- `questions` directly would allow a client to request `correct_option` from the REST API.
-- Therefore:
-- 1. Direct SELECT, INSERT, UPDATE, and DELETE on `questions` are granted EXCLUSIVELY to
--    the teacher who owns the parent exam.
-- 2. Students NEVER receive direct table access to `questions`. Exam delivery (with
--    correct_option and explanation redacted) and post-submission reviews are served
--    exclusively through server API routes using the server-only service role client.

-- [Policy 1: questions_teacher_select]
-- Allows teachers to view all questions for exams they own.
create policy questions_teacher_select on public.questions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.exams
      where exams.id = questions.exam_id
        and exams.teacher_id = (select auth.uid())
    )
  );

-- [Policy 2: questions_teacher_insert]
-- Allows teachers to insert questions only into exams they own.
create policy questions_teacher_insert on public.questions
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.exams
      where exams.id = questions.exam_id
        and exams.teacher_id = (select auth.uid())
    )
  );

-- [Policy 3: questions_teacher_update]
-- Allows teachers to update questions only in exams they own.
create policy questions_teacher_update on public.questions
  for update
  to authenticated
  using (
    exists (
      select 1 from public.exams
      where exams.id = questions.exam_id
        and exams.teacher_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.exams
      where exams.id = questions.exam_id
        and exams.teacher_id = (select auth.uid())
    )
  );

-- [Policy 4: questions_teacher_delete]
-- Allows teachers to delete questions only from exams they own.
create policy questions_teacher_delete on public.questions
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.exams
      where exams.id = questions.exam_id
        and exams.teacher_id = (select auth.uid())
    )
  );

-- ==============================================================================
-- 6.4 attempts Policies
-- ==============================================================================

-- [Policy 1: attempts_student_select]
-- Allows students to view only their own exam attempts.
create policy attempts_student_select on public.attempts
  for select
  to authenticated
  using ((select auth.uid()) = student_id);

-- [Policy 2: attempts_teacher_select]
-- Allows teachers to view all student attempts submitted for exams they created.
create policy attempts_teacher_select on public.attempts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.exams
      where exams.id = attempts.exam_id
        and exams.teacher_id = (select auth.uid())
    )
  );

-- [Policy 3: attempts_student_insert]
-- Allows a student to start an attempt for themselves on a published exam.
create policy attempts_student_insert on public.attempts
  for insert
  to authenticated
  with check (
    (select auth.uid()) = student_id
    and exists (
      select 1 from public.exams
      where exams.id = attempts.exam_id
        and exams.status = 'published'
    )
  );

-- [Policy 4: attempts_student_update]
-- Allows a student to update their attempt while in progress (e.g. marking submitted).
create policy attempts_student_update on public.attempts
  for update
  to authenticated
  using (
    (select auth.uid()) = student_id
    and status = 'in_progress'
  )
  with check ((select auth.uid()) = student_id);

-- [Policy 5: attempts_teacher_update]
-- Allows teachers to update attempts for exams they created (e.g. grading/score adjustments).
create policy attempts_teacher_update on public.attempts
  for update
  to authenticated
  using (
    exists (
      select 1 from public.exams
      where exams.id = attempts.exam_id
        and exams.teacher_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.exams
      where exams.id = attempts.exam_id
        and exams.teacher_id = (select auth.uid())
    )
  );

-- ==============================================================================
-- 6.5 attempt_answers Policies
-- ==============================================================================

-- [Policy 1: attempt_answers_student_select]
-- Allows students to read only answers belonging to their own attempts.
create policy attempt_answers_student_select on public.attempt_answers
  for select
  to authenticated
  using (
    exists (
      select 1 from public.attempts
      where attempts.id = attempt_answers.attempt_id
        and attempts.student_id = (select auth.uid())
    )
  );

-- [Policy 2: attempt_answers_teacher_select]
-- Allows teachers to review student answers on attempts for exams they created.
create policy attempt_answers_teacher_select on public.attempt_answers
  for select
  to authenticated
  using (
    exists (
      select 1 from public.attempts
      join public.exams on exams.id = attempts.exam_id
      where attempts.id = attempt_answers.attempt_id
        and exams.teacher_id = (select auth.uid())
    )
  );

-- [Policy 3: attempt_answers_student_insert]
-- Allows students to record answers only for their own in-progress attempts.
create policy attempt_answers_student_insert on public.attempt_answers
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.attempts
      where attempts.id = attempt_answers.attempt_id
        and attempts.student_id = (select auth.uid())
        and attempts.status = 'in_progress'
    )
  );

-- [Policy 4: attempt_answers_student_update]
-- Allows students to modify their answers only while their attempt remains in progress.
create policy attempt_answers_student_update on public.attempt_answers
  for update
  to authenticated
  using (
    exists (
      select 1 from public.attempts
      where attempts.id = attempt_answers.attempt_id
        and attempts.student_id = (select auth.uid())
        and attempts.status = 'in_progress'
    )
  )
  with check (
    exists (
      select 1 from public.attempts
      where attempts.id = attempt_answers.attempt_id
        and attempts.student_id = (select auth.uid())
        and attempts.status = 'in_progress'
    )
  );

-- ==============================================================================
-- 6.6 attempt_feedback Policies
-- ==============================================================================

-- [Policy 1: attempt_feedback_student_select]
-- Allows students to read feedback only when `released = true` and the feedback
-- belongs to their own attempt. Unreleased drafts remain strictly hidden.
create policy attempt_feedback_student_select on public.attempt_feedback
  for select
  to authenticated
  using (
    released = true
    and exists (
      select 1 from public.attempts
      where attempts.id = attempt_feedback.attempt_id
        and attempts.student_id = (select auth.uid())
    )
  );

-- [Policy 2: attempt_feedback_teacher_select]
-- Allows teachers to view all feedback (including unreleased drafts) for exams they own
-- or feedback authored by themselves.
create policy attempt_feedback_teacher_select on public.attempt_feedback
  for select
  to authenticated
  using (
    (select auth.uid()) = teacher_id
    or exists (
      select 1 from public.attempts
      join public.exams on exams.id = attempts.exam_id
      where attempts.id = attempt_feedback.attempt_id
        and exams.teacher_id = (select auth.uid())
    )
  );

-- [Policy 3: attempt_feedback_teacher_insert]
-- Allows teachers to author feedback (manual or AI draft) for attempts on their exams.
create policy attempt_feedback_teacher_insert on public.attempt_feedback
  for insert
  to authenticated
  with check (
    (select auth.uid()) = teacher_id
    and exists (
      select 1 from public.attempts
      join public.exams on exams.id = attempts.exam_id
      where attempts.id = attempt_feedback.attempt_id
        and exams.teacher_id = (select auth.uid())
    )
  );

-- [Policy 4: attempt_feedback_teacher_update]
-- Allows teachers to edit and release feedback that they authored.
create policy attempt_feedback_teacher_update on public.attempt_feedback
  for update
  to authenticated
  using ((select auth.uid()) = teacher_id)
  with check ((select auth.uid()) = teacher_id);

-- [Policy 5: attempt_feedback_teacher_delete]
-- Allows teachers to delete feedback that they authored.
create policy attempt_feedback_teacher_delete on public.attempt_feedback
  for delete
  to authenticated
  using ((select auth.uid()) = teacher_id);
