-- Wipe all auth users; profiles cascade via FK on auth.users
DELETE FROM auth.users;
DELETE FROM public.profiles;