create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null default '',
  phone text not null default '',
  company text,
  email text,
  website text,
  tags text[] not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_user_id_idx on public.contacts(user_id);
create index contacts_user_created_idx on public.contacts(user_id, created_at desc);

alter table public.contacts enable row level security;

create policy "Users view own contacts" on public.contacts
  for select using (auth.uid() = user_id);
create policy "Users insert own contacts" on public.contacts
  for insert with check (auth.uid() = user_id);
create policy "Users update own contacts" on public.contacts
  for update using (auth.uid() = user_id);
create policy "Users delete own contacts" on public.contacts
  for delete using (auth.uid() = user_id);

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute function public.touch_updated_at();