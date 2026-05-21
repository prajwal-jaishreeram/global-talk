
create or replace function public.guard_credit_balance()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.credit_balance is distinct from old.credit_balance
     and current_setting('role', true) not in ('service_role', 'postgres', 'supabase_admin') then
    -- Allow only via SECURITY DEFINER paths (deduct_credits / add_credits)
    new.credit_balance := old.credit_balance;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_balance
  before update on public.profiles
  for each row execute procedure public.guard_credit_balance();
