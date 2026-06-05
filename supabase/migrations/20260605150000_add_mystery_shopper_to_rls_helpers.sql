-- Allow mystery_shopper to view and mutate their own audit runs/answers via RLS.
-- Three helper functions had hardcoded role lists that excluded mystery_shopper.

-- 1. sc_can_view_area: mystery_shopper treated like auditor (hotel + area assignment check)
create or replace function public.sc_can_view_area(target_area uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hotel_id uuid;
  v_role text;
begin
  select a.hotel_id
  into v_hotel_id
  from public.areas a
  where a.id = target_area
  limit 1;

  if v_hotel_id is null then
    return false;
  end if;

  v_role := public.sc_user_role();

  if v_role in ('superadmin', 'admin', 'general_manager', 'manager', 'quality') then
    return public.sc_is_same_hotel(v_hotel_id);
  end if;

  if v_role in ('auditor', 'mystery_shopper', 'engineering', 'systems', 'it') then
    return public.sc_is_same_hotel(v_hotel_id)
      and public.sc_has_area_assignment(target_area);
  end if;

  return false;
end;
$$;

-- 2. sc_can_view_run: add mystery_shopper
create or replace function public.sc_can_view_run(target_run uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.audit_runs ar
    where ar.id = target_run
      and public.sc_has_role(array['superadmin', 'admin', 'general_manager', 'manager', 'auditor', 'quality', 'mystery_shopper'])
      and public.sc_can_view_area(ar.area_id)
  );
$$;

-- 3. sc_can_mutate_run: add mystery_shopper
create or replace function public.sc_can_mutate_run(target_run uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.audit_runs ar
    where ar.id = target_run
      and public.sc_has_role(array['superadmin', 'admin', 'manager', 'auditor', 'quality', 'mystery_shopper'])
      and public.sc_can_view_area(ar.area_id)
  );
$$;

-- 4. audit_runs INSERT policy: add mystery_shopper
drop policy if exists audit_runs_insert_scoped on public.audit_runs;
create policy audit_runs_insert_scoped
on public.audit_runs
for insert
to authenticated
with check (
  public.sc_has_role(array['superadmin', 'admin', 'manager', 'auditor', 'quality', 'mystery_shopper'])
  and public.sc_can_view_area(area_id)
);