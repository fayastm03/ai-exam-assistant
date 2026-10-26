-- Migration: Harden handle_new_user trigger to strictly assign role 'student'.
-- Ignores any role sent from the browser/client in raw_user_meta_data.
-- Teachers can only be created directly via SQL.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_name text;
begin
  -- Determine display name with safe fallback
  user_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1),
    'User'
  );

  -- Always assign role 'student'. Ignore any 'role' in raw_user_meta_data.
  insert into public.profiles (id, name, role)
  values (new.id, user_name, 'student')
  on conflict (id) do update
  set
    name = coalesce(excluded.name, public.profiles.name),
    updated_at = now();

  return new;
end;
$$;
