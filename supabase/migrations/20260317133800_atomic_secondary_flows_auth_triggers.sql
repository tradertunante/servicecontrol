drop trigger if exists trg_sync_profile_from_auth_user on auth.users;
create trigger trg_sync_profile_from_auth_user
after insert on auth.users
for each row
execute function public.sync_profile_from_auth_user();

drop trigger if exists trg_cleanup_profile_from_auth_user on auth.users;
create trigger trg_cleanup_profile_from_auth_user
after delete on auth.users
for each row
execute function public.cleanup_profile_from_auth_user();
