
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.deduct_credits(uuid, numeric) from public, anon;
revoke execute on function public.add_credits(uuid, numeric) from public, anon, authenticated;
grant execute on function public.deduct_credits(uuid, numeric) to authenticated, service_role;
grant execute on function public.add_credits(uuid, numeric) to service_role;
