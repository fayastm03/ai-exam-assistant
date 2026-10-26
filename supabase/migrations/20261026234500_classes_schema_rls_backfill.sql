-- ==============================================================================
-- Migration: 20261026234500_classes_schema_rls_backfill.sql
-- Description: Classes & Class Memberships schema, join code generator,
--              non-recursive RLS policies, updated exams student policy, and
--              idempotent backfill for existing teachers, exams, and students.
--
-- Strict Execution Order:
--   1. Create Tables (classes, class_members, exam_classes)
--   2. Foreign Key & Query Indexes
--   3. Helper Functions (generate_class_join_code, is_approved_member, is_class_member)
--   4. Triggers (updated_at)
--   5. Enable Row-Level Security (RLS) & Create Policies
--   6. Backfill Existing Data
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create Tables
-- ------------------------------------------------------------------------------

-- 1.1 classes: Teacher-created classrooms with unique 6-character join codes
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  join_code text not null unique,
  join_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.2 class_members: Student membership roster and membership approval state
create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'removed')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_members_class_student_unique unique (class_id, student_id)
);

-- 1.3 exam_classes: Many-to-many junction assigning exams to classes
create table if not exists public.exam_classes (
  exam_id uuid not null references public.exams(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (exam_id, class_id)
);

-- ------------------------------------------------------------------------------
-- 2. Foreign Key & Query Indexes
-- ------------------------------------------------------------------------------

create index if not exists classes_teacher_id_idx on public.classes (teacher_id);
create index if not exists classes_join_code_idx on public.classes (join_code);

create index if not exists class_members_class_id_idx on public.class_members (class_id);
create index if not exists class_members_student_id_idx on public.class_members (student_id);
create index if not exists class_members_class_student_status_idx on public.class_members (class_id, student_id, status);

create index if not exists exam_classes_exam_id_idx on public.exam_classes (exam_id);
create index if not exists exam_classes_class_id_idx on public.exam_classes (class_id);

-- ------------------------------------------------------------------------------
-- 3. Helper Functions
-- ------------------------------------------------------------------------------

-- Helper 3.1: Unique 6-character join code generator
-- Alphabet excludes visually ambiguous / look-alike characters: 0, O, 1, I
-- Alphabet used (32 chars): 23456789ABCDEFGHJKLMNPQRSTUVWXYZ
create or replace function public.generate_class_join_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  result text;
  i integer;
  code_exists boolean;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    end loop;

    -- Ensure collision-free uniqueness in public.classes
    select exists (
      select 1 from public.classes where join_code = result
    ) into code_exists;

    if not code_exists then
      return result;
    end if;
  end loop;
end;
$$;

-- Helper 3.2: Security definer helper checking if calling user is an APPROVED class member
-- Uses fixed search_path = '' to prevent search_path injection and bypasses RLS recursion.
create or replace function public.is_approved_member(p_class_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.class_members
    where class_id = p_class_id
      and student_id = (select auth.uid())
      and status = 'approved'
  );
$$;

revoke execute on function public.is_approved_member(uuid) from public;
grant execute on function public.is_approved_member(uuid) to authenticated;

-- Helper 3.3: Security definer helper checking if calling user has ANY membership in a class
-- Enables students to read classes they have joined without triggering RLS recursion.
create or replace function public.is_class_member(p_class_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.class_members
    where class_id = p_class_id
      and student_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_class_member(uuid) from public;
grant execute on function public.is_class_member(uuid) to authenticated;

-- Helper 3.4: Generic updated_at timestamp refresher
create or replace function public.set_updated_at()
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

-- Set default join code generator on classes table
alter table public.classes
  alter column join_code set default public.generate_class_join_code();

-- ------------------------------------------------------------------------------
-- 4. Triggers
-- ------------------------------------------------------------------------------

-- Trigger 4.1: Maintain updated_at timestamp on classes
drop trigger if exists set_classes_updated_at on public.classes;
create trigger set_classes_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

-- Trigger 4.2: Maintain updated_at timestamp on class_members
drop trigger if exists set_class_members_updated_at on public.class_members;
create trigger set_class_members_updated_at
  before update on public.class_members
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 5. Row-Level Security (RLS) & Policies
-- ------------------------------------------------------------------------------

alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.exam_classes enable row level security;

-- ==============================================================================
-- 5.1 classes Policies
-- ==============================================================================

-- [Policy 1: classes_teacher_select]
-- Allows teachers to view only classes that they created and own.
create policy classes_teacher_select on public.classes
  for select
  to authenticated
  using ((select auth.uid()) = teacher_id);

-- [Policy 2: classes_student_select]
-- Allows students to read metadata for only the classes in which they hold a membership record
-- (pending, approved, rejected, or removed). Non-member classes remain hidden from direct enumeration.
create policy classes_student_select on public.classes
  for select
  to authenticated
  using ((select public.is_class_member(id)));

-- [Policy 3: classes_teacher_insert]
-- Allows only authenticated teachers to create new classes, ensuring teacher_id matches their UID.
create policy classes_teacher_insert on public.classes
  for insert
  to authenticated
  with check (
    (select auth.uid()) = teacher_id
    and (select public.is_teacher())
  );

-- [Policy 4: classes_teacher_update]
-- Allows teachers to update details (name, join_enabled, etc.) of only their own classes.
create policy classes_teacher_update on public.classes
  for update
  to authenticated
  using ((select auth.uid()) = teacher_id)
  with check ((select auth.uid()) = teacher_id);

-- [Policy 5: classes_teacher_delete]
-- Allows teachers to delete only their own classes. Cascade rules will remove memberships and exam links.
create policy classes_teacher_delete on public.classes
  for delete
  to authenticated
  using ((select auth.uid()) = teacher_id);

-- ==============================================================================
-- 5.2 class_members Policies
-- ==============================================================================

-- [Policy 1: class_members_teacher_select]
-- Allows teachers to view all membership records (pending, approved, rejected, removed)
-- belonging exclusively to classes they own.
create policy class_members_teacher_select on public.class_members
  for select
  to authenticated
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_members.class_id
        and c.teacher_id = (select auth.uid())
    )
  );

-- [Policy 2: class_members_student_select]
-- Allows students to read only their own membership records across classes.
-- Students cannot inspect other students' membership status or student IDs.
create policy class_members_student_select on public.class_members
  for select
  to authenticated
  using ((select auth.uid()) = student_id);

-- [Policy 3: class_members_teacher_update]
-- Allows teachers to approve, reject, or remove members only in classes they own.
create policy class_members_teacher_update on public.class_members
  for update
  to authenticated
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_members.class_id
        and c.teacher_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.classes c
      where c.id = class_members.class_id
        and c.teacher_id = (select auth.uid())
    )
  );

-- [Policy 4: class_members_teacher_delete]
-- Allows teachers to explicitly delete membership rows from their classes if needed.
create policy class_members_teacher_delete on public.class_members
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_members.class_id
        and c.teacher_id = (select auth.uid())
    )
  );

-- IMPORTANT SECURITY NOTE ON class_members INSERT:
-- As explicitly specified by system requirements, students CANNOT insert, update, or delete
-- class_members rows directly. Joining a class (by join code) is strictly handled server-side
-- via secure API routes using the privileged service role client after validating the join_code
-- and checking join_enabled. Hence, no client INSERT policy is provided for students.

-- ==============================================================================
-- 5.3 exam_classes Policies
-- ==============================================================================

-- [Policy 1: exam_classes_teacher_select]
-- Allows teachers to view class assignments for exams they authored and classes they own.
create policy exam_classes_teacher_select on public.exam_classes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = exam_classes.exam_id
        and e.teacher_id = (select auth.uid())
    )
    and exists (
      select 1 from public.classes c
      where c.id = exam_classes.class_id
        and c.teacher_id = (select auth.uid())
    )
  );

-- [Policy 2: exam_classes_student_select]
-- Allows students to view exam-class assignments only for classes in which they are APPROVED members.
create policy exam_classes_student_select on public.exam_classes
  for select
  to authenticated
  using ((select public.is_approved_member(class_id)));

-- [Policy 3: exam_classes_teacher_insert]
-- Allows teachers to assign an exam to a class only when they own both the exam and the class.
create policy exam_classes_teacher_insert on public.exam_classes
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.exams e
      where e.id = exam_classes.exam_id
        and e.teacher_id = (select auth.uid())
    )
    and exists (
      select 1 from public.classes c
      where c.id = exam_classes.class_id
        and c.teacher_id = (select auth.uid())
    )
  );

-- [Policy 4: exam_classes_teacher_delete]
-- Allows teachers to remove an exam assignment from a class only for their own exams and classes.
create policy exam_classes_teacher_delete on public.exam_classes
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = exam_classes.exam_id
        and e.teacher_id = (select auth.uid())
    )
    and exists (
      select 1 from public.classes c
      where c.id = exam_classes.class_id
        and c.teacher_id = (select auth.uid())
    )
  );

-- ==============================================================================
-- 5.4 Replacement exams Policy for Students
-- ==============================================================================

-- Drop the old permissive policy where students could see any published exam regardless of class
drop policy if exists exams_student_select on public.exams;

-- [Replacement Policy: exams_student_select]
-- Allows a student to see an exam ONLY when:
--   1. The exam status is 'published'
--   AND
--   2. The exam is assigned in exam_classes to at least one class where the student is an APPROVED member.
create policy exams_student_select on public.exams
  for select
  to authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from public.exam_classes ec
      where ec.exam_id = exams.id
        and (select public.is_approved_member(ec.class_id))
    )
  );

-- ==============================================================================
-- 5.5 questions Policies Confirmation
-- ==============================================================================
-- IMPORTANT SECURITY CONFIRMATION:
-- Questions remain completely closed to direct student access as before.
-- Only the teacher who owns the parent exam has SELECT/INSERT/UPDATE/DELETE access.
-- Student question delivery (with correct_option and explanations redacted before submit)
-- is handled exclusively by server API routes via the service-role client.
-- No student RLS policies are created for questions.

-- ------------------------------------------------------------------------------
-- 6. Backfill Existing Data
-- ------------------------------------------------------------------------------
-- Creates one class named "Default class" per existing teacher, assigns all of that
-- teacher's existing exams to it, and approves every existing student in it.
-- This guarantees existing test data and attempts continue functioning seamlessly.
do $$
declare
  t_record record;
  target_class_id uuid;
begin
  for t_record in (select id from public.profiles where role = 'teacher') loop
    -- 1. Check if teacher already has a "Default class", otherwise insert one
    select id into target_class_id
    from public.classes
    where teacher_id = t_record.id
      and name = 'Default class'
    limit 1;

    if target_class_id is null then
      insert into public.classes (
        id,
        teacher_id,
        name,
        join_code,
        join_enabled,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        t_record.id,
        'Default class',
        public.generate_class_join_code(),
        true,
        now(),
        now()
      )
      returning id into target_class_id;
    end if;

    -- 2. Assign all existing exams of this teacher to the default class
    insert into public.exam_classes (exam_id, class_id)
    select e.id, target_class_id
    from public.exams e
    where e.teacher_id = t_record.id
    on conflict (exam_id, class_id) do nothing;

    -- 3. Approve every existing student in this default class
    insert into public.class_members (
      class_id,
      student_id,
      status,
      requested_at,
      decided_at,
      created_at,
      updated_at
    )
    select
      target_class_id,
      s.id,
      'approved',
      now(),
      now(),
      now(),
      now()
    from public.profiles s
    where s.role = 'student'
    on conflict (class_id, student_id) do update
      set status = 'approved',
          decided_at = coalesce(public.class_members.decided_at, now());
  end loop;
end;
$$;

