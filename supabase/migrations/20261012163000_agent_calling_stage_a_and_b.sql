-- Migration: 20261012163000_agent_calling_stage_a_and_b.sql
-- Description: Core tables for Agent API (Stage A) & data models reserved for Stage B.

-- 1. Extend profiles with compliance, approval and feature flags
alter table public.profiles
  add column if not exists account_approval_status text not null default 'approved', -- 'pending' | 'approved' | 'suspended'
  add column if not exists business_name text,
  add column if not exists business_website text,
  add column if not exists use_case_description text,
  add column if not exists ai_voice_enabled boolean not null default false,
  add column if not exists auto_pause_ai boolean not null default false;

-- 2. API Keys table
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  key_prefix text not null, -- e.g. 'rg_live_a1b2' or 'rg_test_c3d4'
  key_hash text not null unique, -- SHA-256 of the secret key
  mode text not null default 'live' check (mode in ('live', 'test')),
  scopes text[] not null default array['calls:read', 'calls:write', 'billing:read', 'webhooks:manage'],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists api_keys_user_id_idx on public.api_keys(user_id);
create index if not exists api_keys_key_hash_idx on public.api_keys(key_hash);

-- 3. Account Limits & Safety Controls
create table if not exists public.account_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  daily_spend_cap numeric(10,4) not null default 50.0000,
  daily_call_cap integer not null default 100,
  max_call_duration_seconds integer not null default 1800, -- 30 minutes
  max_concurrent_calls integer not null default 1,
  max_attempts_per_number_per_day integer not null default 1,
  allowed_countries text[], -- null means all non-denylisted countries allowed
  is_killed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Global Denylist (Emergency numbers, premium numbers, fraud prefixes)
create table if not exists public.denylist_destinations (
  id uuid primary key default gen_random_uuid(),
  pattern text not null unique, -- regex or prefix (e.g. '^(\+?1)?(900|976)', '^\+881')
  reason text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed critical emergency & premium rate patterns
insert into public.denylist_destinations (pattern, reason) values
  ('^(\+?1)?(911|112|999|000)$', 'Emergency Services'),
  ('^(\+?1)?[0-9]{3}911[0-9]{4}$', 'Potential Emergency routing'),
  ('^(\+?1)?(900|976)[0-9]{7}$', 'North America Premium Rate'),
  ('^\+881[0-9]+$', 'Global Satellite Systems'),
  ('^\+882[0-9]+$', 'International Networks / High Fraud'),
  ('^\+883[0-9]+$', 'International Networks'),
  ('^\+239[0-9]+$', 'High-fraud premium destination')
on conflict (pattern) do nothing;

-- 5. Global Suppression List (Never-Call / Opt-Outs for Stage B ready)
create table if not exists public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade, -- null = global
  phone_number text not null,
  reason text default 'opt-out',
  created_at timestamptz not null default now()
);

create index if not exists suppression_phone_idx on public.suppression_list(phone_number);

-- 6. Call Tasks (Stage A: Agent-requested calls)
create table if not exists public.call_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  to_number text not null,
  from_number text,
  country_code text,
  mode text not null default 'assisted' check (mode in ('assisted', 'bridge', 'autonomous')),
  status text not null default 'queued' check (
    status in ('queued', 'awaiting_human', 'ringing', 'in_progress', 'completed', 'failed', 'canceled', 'expired', 'no_answer')
  ),
  goal text,
  script text,
  notes text,
  context jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  consent_attestation boolean not null default false,
  scheduled_for timestamptz,
  destination_timezone text,
  rate_per_minute numeric(10,4) not null default 0,
  max_duration_seconds integer not null default 900, -- 15 mins default
  duration_seconds integer not null default 0,
  cost numeric(10,4) not null default 0,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  call_id uuid references public.calls(id) on delete set null,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists call_tasks_user_status_idx on public.call_tasks(user_id, status);
create index if not exists call_tasks_scheduled_idx on public.call_tasks(scheduled_for) where status = 'queued';

-- 7. Call Attempts (Stage B ready, tracking human dials in Stage A)
create table if not exists public.call_attempts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.call_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_number integer not null default 1,
  status text not null default 'initiated',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  hangup_cause text,
  cost numeric(10,4) not null default 0,
  metadata jsonb default '{}'::jsonb
);

create index if not exists call_attempts_task_idx on public.call_attempts(task_id);

-- 8. Balance Holds Table
create table if not exists public.balance_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.call_tasks(id) on delete cascade,
  held_amount numeric(10,4) not null,
  status text not null default 'active' check (status in ('active', 'settled', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists balance_holds_user_active_idx on public.balance_holds(user_id) where status = 'active';
create index if not exists balance_holds_task_idx on public.balance_holds(task_id);

-- 9. Webhook Endpoints & Deliveries
create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  secret text not null, -- Signing secret used for HMAC SHA-256
  events text[] not null default array['call.queued', 'call.awaiting_human', 'call.started', 'call.completed', 'call.failed', 'call.canceled'],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists webhook_endpoints_user_idx on public.webhook_endpoints(user_id);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status_code integer,
  error_message text,
  attempts integer not null default 0,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists webhook_deliveries_retry_idx on public.webhook_deliveries(next_retry_at) where delivered_at is null;

-- 10. API Audit Log
create table if not exists public.api_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  ip_address text,
  user_agent text,
  endpoint text not null,
  http_method text not null,
  status_code integer not null,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists api_audit_logs_user_idx on public.api_audit_logs(user_id, created_at desc);

-- 11. Atomic Balance Hold & Settle Functions
create or replace function public.hold_credits_for_task(
  _user_id uuid,
  _task_id uuid,
  _estimated_cost numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _current_balance numeric;
  _active_holds numeric;
  _available numeric;
begin
  select credit_balance into _current_balance
  from public.profiles
  where id = _user_id for update;

  if _current_balance is null then
    return false;
  end if;

  select coalesce(sum(held_amount), 0) into _active_holds
  from public.balance_holds
  where user_id = _user_id and status = 'active';

  _available := _current_balance - _active_holds;

  if _available < _estimated_cost then
    return false;
  end if;

  insert into public.balance_holds (user_id, task_id, held_amount, status)
  values (_user_id, _task_id, _estimated_cost, 'active');

  return true;
end;
$$;

create or replace function public.settle_task_balance(
  _task_id uuid,
  _actual_cost numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  _hold record;
  _new_balance numeric;
begin
  select * into _hold
  from public.balance_holds
  where task_id = _task_id and status = 'active'
  limit 1
  for update;

  if _hold.id is not null then
    update public.balance_holds
    set status = 'settled', updated_at = now()
    where id = _hold.id;
  end if;

  if _actual_cost > 0 then
    update public.profiles
    set credit_balance = credit_balance - _actual_cost,
        updated_at = now()
    where id = _hold.user_id
    returning credit_balance into _new_balance;
  else
    select credit_balance into _new_balance from public.profiles where id = _hold.user_id;
  end if;

  return _new_balance;
end;
$$;

create or replace function public.release_task_hold(
  _task_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.balance_holds
  set status = 'released', updated_at = now()
  where task_id = _task_id and status = 'active';

  return true;
end;
$$;

-- 12. Row Level Security Policies
alter table public.api_keys enable row level security;
alter table public.account_limits enable row level security;
alter table public.denylist_destinations enable row level security;
alter table public.suppression_list enable row level security;
alter table public.call_tasks enable row level security;
alter table public.call_attempts enable row level security;
alter table public.balance_holds enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.api_audit_logs enable row level security;

-- Policies for authenticated users accessing their own rows
create policy "Users manage own api_keys" on public.api_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users view own account_limits" on public.account_limits
  for select using (auth.uid() = user_id);

create policy "Anyone can read active denylist" on public.denylist_destinations
  for select using (is_active = true);

create policy "Users manage own suppression" on public.suppression_list
  for all using (auth.uid() = user_id or user_id is null) with check (auth.uid() = user_id);

create policy "Users manage own call_tasks" on public.call_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own call_attempts" on public.call_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users view own balance_holds" on public.balance_holds
  for select using (auth.uid() = user_id);

create policy "Users manage own webhook_endpoints" on public.webhook_endpoints
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users view own webhook_deliveries" on public.webhook_deliveries
  for select using (auth.uid() = user_id);

create policy "Users view own audit_logs" on public.api_audit_logs
  for select using (auth.uid() = user_id);

-- Enable Supabase Realtime for call_tasks (so human dialer hears new requests immediately)
alter publication supabase_realtime add table public.call_tasks;
alter table public.call_tasks replica identity full;
