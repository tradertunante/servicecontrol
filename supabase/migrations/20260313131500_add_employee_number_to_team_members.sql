alter table public.team_members
add column if not exists employee_number text;

create unique index if not exists team_members_hotel_employee_number_unique
on public.team_members (hotel_id, employee_number)
where employee_number is not null and btrim(employee_number) <> '';
