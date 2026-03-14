alter table public.training_attendances
add column if not exists team_member_id uuid references public.team_members(id) on delete restrict;

create unique index if not exists training_attendances_session_team_member_unique
on public.training_attendances (session_id, team_member_id)
where team_member_id is not null;
