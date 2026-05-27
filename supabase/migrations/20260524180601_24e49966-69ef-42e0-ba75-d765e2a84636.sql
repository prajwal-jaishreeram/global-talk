create table public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  phone_number text not null,
  country_code text,
  monthly_cost numeric not null default 0,
  status text not null default 'active',
  telnyx_order_id text,
  telnyx_number_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phone_number)
);

create index phone_numbers_user_idx on public.phone_numbers(user_id);

alter table public.phone_numbers enable row level security;

create policy "Users view own numbers" on public.phone_numbers
  for select using (auth.uid() = user_id);
create policy "Users insert own numbers" on public.phone_numbers
  for insert with check (auth.uid() = user_id);
create policy "Users delete own numbers" on public.phone_numbers
  for delete using (auth.uid() = user_id);

create trigger phone_numbers_updated_at
  before update on public.phone_numbers
  for each row execute function public.touch_updated_at();