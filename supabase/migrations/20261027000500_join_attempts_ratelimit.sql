-- ==============================================================================
-- Migration: 20261027000500_join_attempts_ratelimit.sql
-- Description: Rate limiting table for student class join requests.
--              Stores join attempts to restrict students to 10 attempts per 15 minutes.
--              DO NOT RUN THIS MIGRATION (will be applied via CI / migration runner).
-- ==============================================================================

create table if not exists public.join_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

-- Index for fast time-window rate limit checks: (user_id, attempted_at desc)
create index if not exists join_attempts_user_time_idx
  on public.join_attempts (user_id, attempted_at desc);

-- Enable RLS: students cannot manipulate or inspect join attempts directly
alter table public.join_attempts enable row level security;

-- Policy: Only service role accesses this table for rate limiting.
-- Authenticated users have no direct table policies.

