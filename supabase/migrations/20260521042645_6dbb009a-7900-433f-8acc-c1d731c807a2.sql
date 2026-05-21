
-- Profiles
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  credit_balance numeric(10,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Calls
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  to_number text not null,
  from_number text,
  country_code text,
  rate_per_minute numeric(10,4),
  duration_seconds integer not null default 0,
  cost numeric(10,4) not null default 0,
  status text not null default 'initiated',
  telnyx_call_control_id text,
  recording_url text,
  transcript text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calls_user_id_created_at_idx on public.calls(user_id, created_at desc);
create index calls_telnyx_ccid_idx on public.calls(telnyx_call_control_id);

-- Credit purchases
create table public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_usd numeric(10,2) not null,
  credits_added numeric(10,4) not null,
  stripe_payment_intent_id text,
  stripe_session_id text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index credit_purchases_user_idx on public.credit_purchases(user_id, created_at desc);
create unique index credit_purchases_session_idx on public.credit_purchases(stripe_session_id) where stripe_session_id is not null;

-- RLS
alter table public.profiles enable row level security;
alter table public.calls enable row level security;
alter table public.credit_purchases enable row level security;

create policy "Users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Users view own calls" on public.calls for select using (auth.uid() = user_id);
create policy "Users insert own calls" on public.calls for insert with check (auth.uid() = user_id);

create policy "Users view own purchases" on public.credit_purchases for select using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Atomic credit deduction; returns new balance, or null if insufficient
create or replace function public.deduct_credits(_user_id uuid, _amount numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  _new_balance numeric;
begin
  update public.profiles
    set credit_balance = credit_balance - _amount,
        updated_at = now()
    where id = _user_id and credit_balance >= _amount
    returning credit_balance into _new_balance;
  return _new_balance;
end;
$$;

-- Add credits (called from webhook by service role)
create or replace function public.add_credits(_user_id uuid, _amount numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  _new_balance numeric;
begin
  update public.profiles
    set credit_balance = credit_balance + _amount,
        updated_at = now()
    where id = _user_id
    returning credit_balance into _new_balance;
  return _new_balance;
end;
$$;

-- updated_at trigger helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles
  for each row execute procedure public.touch_updated_at();
create trigger calls_touch before update on public.calls
  for each row execute procedure public.touch_updated_at();
create trigger credit_purchases_touch before update on public.credit_purchases
  for each row execute procedure public.touch_updated_at();

-- Realtime for profiles (credit balance live updates)
alter publication supabase_realtime add table public.profiles;
alter table public.profiles replica identity full;
