alter table public.training_attendances
add column if not exists team_member_id uuid references public.team_members(id) on delete restrict;

create unique index if not exists training_attendances_session_team_member_unique
on public.training_attendances (session_id, team_member_id)
where team_member_id is not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'training_attendances'
      and column_name = 'employee_profile_id'
      and is_nullable = 'NO'
  ) then
    alter table public.training_attendances
    alter column employee_profile_id drop not null;
  end if;
end
$$;

notify pgrst, 'reload schema';
