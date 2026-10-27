-- ==============================================================================
-- Migration: 20261027120000_automatic_ai_feedback.sql
-- Description: Automatic AI feedback for students
--  1. Update check constraint on attempt_feedback to include 'ai_auto' and 'auto_template'
--  2. Add partial unique index ensuring each attempt has at most one overall row
--     (question_id is null) where source is 'ai_auto' or 'auto_template'
--  3. Preserve RLS: students read only released rows on their own attempt
-- ==============================================================================

-- 1. Update source check constraint on attempt_feedback
alter table public.attempt_feedback
  drop constraint if exists attempt_feedback_source_check;

alter table public.attempt_feedback
  add constraint attempt_feedback_source_check
  check (source in ('manual', 'ai_draft', 'ai_auto', 'auto_template'));

-- 2. Partial unique index to prevent duplicate overall automatic feedback rows per attempt
-- Concurrency safe: prevents race conditions between simultaneous result reads / bulk generation
create unique index if not exists attempt_feedback_attempt_ai_auto_unique
  on public.attempt_feedback (attempt_id)
  where question_id is null and source in ('ai_auto', 'auto_template');

-- 3. Document RLS behavior:
-- The existing attempt_feedback_student_select policy remains active:
--   released = true and exists (select 1 from public.attempts where id = attempt_id and student_id = auth.uid())
-- Automatic feedback is created with released = true by default. If a teacher hides it (released = false),
-- RLS automatically prevents students from viewing it.

