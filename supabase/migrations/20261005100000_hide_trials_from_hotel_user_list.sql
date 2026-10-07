-- Los prospectos del trial viven en el hotel demo compartido (con membresía en
-- TRIAL_DEMO_HOTEL_ID y profiles.is_trial = true). La RPC es security definer y,
-- sin este filtro, el admin del hotel demo veía nombre y email de todos los
-- prospectos en /users y podía editarlos, desactivarlos o borrarlos.
-- Excluimos los perfiles trial. Base: definición de 20261004110000 (membresías).

create or replace function public.list_hotel_users_with_meta(p_hotel_id uuid)
returns table (
  id                 uuid,
  full_name          text,
  email              text,
  role               text,
  active             boolean,
  hotel_id           uuid,
  last_sign_in_at    timestamptz,
  email_confirmed_at timestamptz,
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
    m.role::text,
    (coalesce(p.active, true) and m.active) as active,
    p_hotel_id as hotel_id,
    u.last_sign_in_at,
    u.email_confirmed_at,
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
  from public.hotel_memberships m
  join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = p.id
  where m.hotel_id = p_hotel_id
    and lower(trim(coalesce(p.role, ''))) <> 'superadmin'
    and coalesce(p.is_trial, false) = false
  order by p.full_name asc nulls last
  limit 200;
$$;
