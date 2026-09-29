-- AI PM Coach: database setup for accounts, cloud progress and sign-in tracking.
-- Paste this whole file into Supabase > SQL Editor > New query, and click Run. Safe to run again.

-- One row per learner with their full app progress.
create table if not exists public.progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- One row per learner per day they used the app, with how many times they signed in that day.
create table if not exists public.activity (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  logins     integer not null default 0,
  pings      integer not null default 0,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists activity_day_idx on public.activity (day);

-- Lock both tables: with row level security on and no policies, only the site's server
-- function (which uses the secret key) can read or write them. Browsers can't.
alter table public.progress enable row level security;
alter table public.activity enable row level security;

-- Records a visit (and optionally a sign-in) for a learner on a given day.
create or replace function public.track_activity(uid uuid, d date, is_login boolean)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.activity (user_id, day, logins, pings)
  values (uid, d, case when is_login then 1 else 0 end, 1)
  on conflict (user_id, day) do update
    set logins = public.activity.logins + excluded.logins,
        pings = public.activity.pings + 1,
        last_seen = now();
$$;
revoke execute on function public.track_activity(uuid, date, boolean) from public, anon, authenticated;
grant execute on function public.track_activity(uuid, date, boolean) to service_role;
