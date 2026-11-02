-- ==============================================================================
-- Migration: 20261102000000_production_hardening_indexes_ratelimit.sql
-- Description: Production Hardening Database Enhancements
--  1. Composite indexes on attempts, attempt_answers, and questions for optimal query performance
--  2. Generalized API and AI rate-limiting table for sliding window enforcement
--  3. Strict Row-Level Security (RLS) on all added tables
-- ==============================================================================

-- 1. Performance Composite Indexes
create index if not exists attempts_exam_status_idx
  on public.attempts (exam_id, status);

create index if not exists attempts_student_status_idx
  on public.attempts (student_id, status);

create index if not exists attempt_answers_attempt_chosen_idx
  on public.attempt_answers (attempt_id, chosen_option);

create index if not exists questions_exam_review_idx
  on public.questions (exam_id, review_status);

create index if not exists classes_teacher_id_idx
  on public.classes (teacher_id);

create index if not exists class_members_student_status_idx
  on public.class_members (student_id, status);

-- 2. General Rate Limiting Table
-- Used for distributed sliding-window rate limiting across serverless instances
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,                -- e.g. "ai:user_uuid", "auth:ip_address"
  action text not null,             -- e.g. "ai_generate", "join_class", "save_answer"
  timestamp timestamptz not null default now()
);

-- Index for time-window range filtering
create index if not exists rate_limits_key_action_time_idx
  on public.rate_limits (key, action, timestamp desc);

-- Enable RLS: No direct client access; accessed strictly by service role
alter table public.rate_limits enable row level security;
