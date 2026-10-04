-- Multi-hotel para usuarios no superadmin.
--
-- hotel_memberships pasa a ser la fuente de verdad de "a qué hoteles pertenece
-- un usuario y con qué rol en cada uno". profiles.hotel_id / profiles.role siguen
-- representando el hotel ACTIVO y se sincronizan desde la membresía mediante
-- triggers. Así el código existente (lib/auth, policies sc_*, ~127 archivos que
-- leen profiles.hotel_id) no necesita cambios para el hotel activo.
--
-- Solo superadmin escribe membresías (RLS existente de hotel_memberships).

-- 0. Unicidad (user_id, hotel_id). Falla en lugar de borrar datos si hay duplicados.
do $$
begin
  if exists (
    select 1
    from public.hotel_memberships
    group by user_id, hotel_id
    having count(*) > 1
  ) then
    raise exception 'hotel_memberships tiene duplicados (user_id, hotel_id); resolver antes de migrar';
  end if;
end $$;

create unique index if not exists hotel_memberships_user_hotel_key
  on public.hotel_memberships (user_id, hotel_id);

-- 1. Backfill: cada perfil no superadmin con hotel tiene su membresía.
insert into public.hotel_memberships (user_id, hotel_id, role, active)
select p.id, p.hotel_id, lower(trim(coalesce(p.role, ''))), coalesce(p.active, true)
from public.profiles p
where p.hotel_id is not null
  and lower(trim(coalesce(p.role, ''))) <> 'superadmin'
on conflict (user_id, hotel_id) do update
  set role = excluded.role
  where public.hotel_memberships.role is distinct from excluded.role;

-- 2. sc_user_hotel_id: el hotel activo solo cuenta si la membresía está activa.
--    Superadmin queda igual (no depende de membresías).
create or replace function public.sc_user_hotel_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.hotel_id
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.active, true) = true
    and (
      lower(trim(coalesce(p.role, ''))) = 'superadmin'
      or exists (
        select 1
        from public.hotel_memberships m
        where m.user_id = p.id
          and m.hotel_id = p.hotel_id
          and m.active = true
      )
    )
  limit 1;
$$;

-- 3. profiles -> hotel_memberships: al asignar hotel/rol en el perfil (alta de
--    usuario, cambio de rol por admin, cambio de hotel activo) se refleja la
--    membresía del hotel correspondiente.
create or replace function public.sync_membership_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(trim(coalesce(new.role, '')));
begin
  if new.hotel_id is null or v_role = 'superadmin' then
    return new;
  end if;

  insert into public.hotel_memberships (user_id, hotel_id, role, active)
  values (new.id, new.hotel_id, v_role, true)
  on conflict (user_id, hotel_id) do update
    set role = excluded.role
    where public.hotel_memberships.role is distinct from excluded.role;

  -- No se puede activar un hotel cuya membresía está desactivada.
  if not exists (
    select 1
    from public.hotel_memberships m
    where m.user_id = new.id
      and m.hotel_id = new.hotel_id
      and m.active = true
  ) then
    raise exception 'El usuario no tiene una membresía activa en el hotel %', new.hotel_id
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_membership_from_profile on public.profiles;
create trigger trg_sync_membership_from_profile
  after insert or update of hotel_id, role on public.profiles
  for each row execute function public.sync_membership_from_profile();

-- 4. hotel_memberships -> profiles: si cambia el rol o se desactiva/borra la
--    membresía del hotel activo, el perfil se re-sincroniza. Si el hotel activo
--    se pierde, pasa al siguiente hotel activo (o queda sin hotel).
create or replace function public.sync_profile_from_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.hotel_memberships%rowtype;
  v_fallback public.hotel_memberships%rowtype;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;

  -- Solo interesa si es el hotel activo del usuario.
  if not exists (
    select 1
    from public.profiles p
    where p.id = v_row.user_id
      and p.hotel_id = v_row.hotel_id
  ) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    if new.active = true then
      update public.profiles
      set role = new.role
      where id = new.user_id
        and hotel_id = new.hotel_id
        and lower(trim(coalesce(role, ''))) is distinct from lower(trim(new.role));
      return null;
    end if;
  end if;

  select m.*
  into v_fallback
  from public.hotel_memberships m
  where m.user_id = v_row.user_id
    and m.hotel_id <> v_row.hotel_id
    and m.active = true
  order by m.created_at asc
  limit 1;

  if found then
    update public.profiles
    set hotel_id = v_fallback.hotel_id,
        role = v_fallback.role
    where id = v_row.user_id;
  else
    update public.profiles
    set hotel_id = null
    where id = v_row.user_id;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_profile_from_membership on public.hotel_memberships;
create trigger trg_sync_profile_from_membership
  after update of role, active or delete on public.hotel_memberships
  for each row execute function public.sync_profile_from_membership();
