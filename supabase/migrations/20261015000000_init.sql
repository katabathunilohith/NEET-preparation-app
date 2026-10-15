-- NEET Pathfinder schema. Runs on Supabase's free tier.
-- Apply with the Supabase CLI (`supabase db push`) or paste into Dashboard → SQL Editor.

-- ── profiles ────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'student' check (role in ('student', 'guardian')),
  created_at timestamptz not null default now()
);

-- Create a profile row automatically for every new sign-up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── student progress (one JSON document per student) ───
create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── guardians (parents/siblings who may view a student) ─
create table if not exists public.guardians (
  student_id uuid not null references auth.users (id) on delete cascade,
  guardian_email text not null,
  created_at timestamptz not null default now(),
  primary key (student_id, guardian_email)
);
create index if not exists guardians_email_idx on public.guardians (lower(guardian_email));

-- ── admins (may publish to the shared question bank) ────
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ── shared question bank ────────────────────────────────
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  chapter_id text not null,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  concept text not null default 'General',
  text text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  answer smallint not null check (answer between 0 and 3),
  explanation text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists questions_chapter_idx on public.questions (chapter_id);

-- ── helpers ─────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.is_guardian_of(student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.guardians
    where student_id = student and lower(guardian_email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- ── row level security ──────────────────────────────────
alter table public.profiles enable row level security;
alter table public.user_state enable row level security;
alter table public.guardians enable row level security;
alter table public.admins enable row level security;
alter table public.questions enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "guardian reads student profile" on public.profiles;
create policy "guardian reads student profile" on public.profiles for select using (public.is_guardian_of(id));

drop policy if exists "own state" on public.user_state;
create policy "own state" on public.user_state for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "guardian reads state" on public.user_state;
create policy "guardian reads state" on public.user_state for select using (public.is_guardian_of(user_id));

drop policy if exists "student manages guardians" on public.guardians;
create policy "student manages guardians" on public.guardians for all using (student_id = auth.uid()) with check (student_id = auth.uid());
drop policy if exists "guardian sees own links" on public.guardians;
create policy "guardian sees own links" on public.guardians for select
  using (lower(guardian_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "read own admin row" on public.admins;
create policy "read own admin row" on public.admins for select using (user_id = auth.uid());

drop policy if exists "signed-in users read questions" on public.questions;
create policy "signed-in users read questions" on public.questions for select to authenticated using (true);
drop policy if exists "admins write questions" on public.questions;
create policy "admins write questions" on public.questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Live sync between her devices.
do $$ begin
  alter publication supabase_realtime add table public.user_state;
exception when others then null;
end $$;
