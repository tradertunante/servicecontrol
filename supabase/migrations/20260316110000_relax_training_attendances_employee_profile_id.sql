alter table public.training_attendances
add column if not exists team_member_id uuid references public.team_members(id) on delete restrict;

alter table public.training_attendances
alter column employee_profile_id drop not null;

notify pgrst, 'reload schema';
