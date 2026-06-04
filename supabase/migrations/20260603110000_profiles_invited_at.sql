-- Track when a user was invited/created by an admin so we can detect
-- users who have never actually logged in, even when Supabase auto-sets
-- last_sign_in_at on createUser via the Admin API.

alter table public.profiles
  add column if not exists invited_at timestamptz default null;

-- Backfill: mark all existing users who have never confirmed their email
-- as invited (approximate — created_at from auth.users is the best proxy).
update public.profiles p
set invited_at = u.created_at
from auth.users u
where u.id = p.id
  and p.invited_at is null
  and u.last_sign_in_at is not null
  and u.last_sign_in_at - u.created_at < interval '10 minutes';

-- Drop and recreate RPC to add invited_at column (can't change return type with replace)
drop function if exists public.list_hotel_users_with_meta(uuid);

create function public.list_hotel_users_with_meta(p_hotel_id uuid)
returns table (
  id                 uuid,
  full_name          text,
  email              text,
  role               text,
  active             boolean,
  hotel_id           uuid,
  last_sign_in_at    timestamptz,
  email_confirmed_at timestamptz,
  invited_at         timestamptz,
  areas              jsonb,
  audit_run_count    bigint
)
security definer
set search_path = public, auth
language sql
stable
as $$
  select
    p.id,
    p.full_name::text,
    p.email::text,
    p.role::text,
    p.active,
    p.hotel_id,
    u.last_sign_in_at,
    u.email_confirmed_at,
    p.invited_at,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('id', a.id::text, 'name', a.name) order by a.name)
        from public.user_area_access uaa
        join public.areas a on a.id = uaa.area_id and a.active = true
        where uaa.user_id = p.id and uaa.hotel_id = p_hotel_id
      ),
      '[]'::jsonb
    ) as areas,
    (
      select count(*)
      from public.audit_runs r
      where r.executed_by = p.id
        and r.hotel_id = p_hotel_id
        and r.archived_at is null
    ) as audit_run_count
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.hotel_id = p_hotel_id
  order by p.full_name asc nulls last
  limit 200;
$$;