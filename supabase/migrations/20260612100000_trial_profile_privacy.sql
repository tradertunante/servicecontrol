-- Trials comparten el hotel demo con rol elevado: un prospecto podía leer
-- nombre y email de los demás prospectos vía profiles (RGPD) y, con rol
-- admin, desactivarlos o editar settings del hotel.
--
-- 1. sc_can_read_profile: un actor trial solo puede leer su propio perfil.
-- 2. Downgrade de trials existentes: admin → quality (en profiles y en
--    auth.users.raw_user_meta_data, porque sync_profile_from_auth_user
--    reescribiría el rol antiguo en el próximo update del usuario).
--
-- El registro de trials nuevos ya crea rol quality (app/api/trial/register).

-- 1. Bloquear lectura de perfiles ajenos para actores trial
create or replace function public.sc_can_read_profile(target_profile uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hotel_id uuid;
  v_actor_role text;
begin
  if auth.uid() = target_profile then
    return true;
  end if;

  -- Los trials comparten el hotel demo: nunca leen perfiles de otros
  if exists (
    select 1
    from public.profiles a
    where a.id = auth.uid()
      and a.is_trial
  ) then
    return false;
  end if;

  select p.hotel_id
  into v_hotel_id
  from public.profiles p
  where p.id = target_profile
  limit 1;

  if v_hotel_id is null then
    return false;
  end if;

  v_actor_role := public.sc_user_role();

  if v_actor_role in ('superadmin', 'admin', 'general_manager', 'manager', 'quality') then
    return public.sc_is_same_hotel(v_hotel_id);
  end if;

  return false;
end;
$$;

-- 2. Downgrade de trials existentes con rol admin
update public.profiles
set role = 'quality'
where is_trial = true
  and role = 'admin';

update auth.users u
set raw_user_meta_data = jsonb_set(
  coalesce(u.raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"quality"'
)
where coalesce((u.raw_user_meta_data ->> 'is_trial')::boolean, false)
  and u.raw_user_meta_data ->> 'role' = 'admin';