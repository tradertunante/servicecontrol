create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_full_name text;
  v_role text;
  v_hotel_id uuid;
  v_active boolean;
begin
  v_full_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  v_role := lower(nullif(btrim(coalesce(new.raw_user_meta_data ->> 'role', '')), ''));
  v_active := coalesce((new.raw_user_meta_data ->> 'active')::boolean, true);

  if nullif(coalesce(new.raw_user_meta_data ->> 'hotel_id', ''), '') is not null then
    v_hotel_id := (new.raw_user_meta_data ->> 'hotel_id')::uuid;
  else
    v_hotel_id := null;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    hotel_id,
    active,
    is_trial
  )
  values (
    new.id,
    new.email,
    v_full_name,
    case
      when v_role in ('superadmin', 'admin', 'general_manager', 'manager', 'auditor', 'quality', 'engineering', 'it', 'systems')
        then v_role
      else 'auditor'
    end,
    v_hotel_id,
    v_active,
    coalesce((new.raw_user_meta_data ->> 'is_trial')::boolean, false)
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    hotel_id = excluded.hotel_id,
    active = excluded.active,
    is_trial = excluded.is_trial;

  return new;
end;
$$;