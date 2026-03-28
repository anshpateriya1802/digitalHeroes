-- Drive for Good PRD schema
-- Run in a new Supabase project SQL editor.

create extension if not exists pgcrypto;

create type public.app_role as enum ('subscriber', 'admin');
create type public.plan_type as enum ('monthly', 'yearly');
create type public.subscription_status as enum ('active', 'inactive', 'lapsed', 'canceled');
create type public.draw_mode as enum ('random', 'algorithmic');
create type public.claim_status as enum ('pending', 'approved', 'rejected');
create type public.payout_status as enum ('pending', 'paid');

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text unique not null,
  full_name text not null,
  role public.app_role not null default 'subscriber',
  created_at timestamptz not null default now()
);

create unique index if not exists users_full_name_unique_idx
  on public.users (lower(full_name));

create unique index if not exists users_email_ci_unique_idx
  on public.users (lower(email));

create table if not exists public.charities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text not null,
  image_url text,
  upcoming_events jsonb not null default '[]'::jsonb,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan public.plan_type not null,
  status public.subscription_status not null,
  renewal_date date,
  amount numeric(10,2) not null check (amount >= 0),
  payment_customer_id text,
  payment_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_charity_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  charity_id uuid references public.charities(id),
  contribution_percent numeric(5,2) not null check (contribution_percent >= 0 and contribution_percent <= 100),
  effective_from timestamptz not null default now()
);

create table if not exists public.golf_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  score int not null check (score between 1 and 45),
  played_at date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.draws (
  id uuid primary key default gen_random_uuid(),
  month_key text not null,
  mode public.draw_mode not null,
  numbers int[] not null check (array_length(numbers, 1) = 5),
  is_published boolean not null default false,
  simulated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists draws_one_published_per_month
  on public.draws(month_key)
  where is_published = true;

create table if not exists public.draw_entries (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  user_numbers int[] not null check (array_length(user_numbers, 1) = 5),
  match_count int not null check (match_count between 0 and 5),
  created_at timestamptz not null default now()
);

create table if not exists public.prize_pools (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null unique references public.draws(id) on delete cascade,
  total_pool numeric(12,2) not null check (total_pool >= 0),
  pool_5 numeric(12,2) not null check (pool_5 >= 0),
  pool_4 numeric(12,2) not null check (pool_4 >= 0),
  pool_3 numeric(12,2) not null check (pool_3 >= 0),
  rollover_in numeric(12,2) not null default 0,
  rollover_out numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.winner_claims (
  id uuid primary key default gen_random_uuid(),
  draw_entry_id uuid not null references public.draw_entries(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  proof_url text,
  claim_status public.claim_status not null default 'pending',
  payout_status public.payout_status not null default 'pending',
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.charity_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  charity_id uuid references public.charities(id),
  contribution_percent numeric(5,2) not null check (contribution_percent >= 0 and contribution_percent <= 100),
  amount numeric(12,2) not null check (amount >= 0),
  period_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  delivery_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create or replace function public.bump_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.bump_updated_at();

create or replace function public.enforce_max_5_scores()
returns trigger
language plpgsql
as $$
begin
  delete from public.golf_scores
  where id in (
    select id
    from public.golf_scores
    where user_id = new.user_id
    order by played_at asc, created_at asc
    offset 5
  );
  return new;
end;
$$;

drop trigger if exists scores_max_5_trigger on public.golf_scores;
create trigger scores_max_5_trigger
after insert on public.golf_scores
for each row execute function public.enforce_max_5_scores();

-- Minimal RLS scaffold
alter table public.users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_charity_preferences enable row level security;
alter table public.golf_scores enable row level security;
alter table public.draw_entries enable row level security;
alter table public.winner_claims enable row level security;

create policy "users can read own profile"
on public.users for select
using (auth.uid() = auth_user_id);

create policy "users can read own subscriptions"
on public.subscriptions for select
using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "users can manage own scores"
on public.golf_scores for all
using (user_id in (select id from public.users where auth_user_id = auth.uid()))
with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "users can read own draw entries"
on public.draw_entries for select
using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "users can read own winner claims"
on public.winner_claims for select
using (user_id in (select id from public.users where auth_user_id = auth.uid()));