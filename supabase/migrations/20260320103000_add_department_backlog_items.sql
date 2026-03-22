create table if not exists public.department_backlog_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete cascade,
  audit_run_id uuid not null references public.audit_runs(id) on delete cascade,
  question_id uuid not null references public.audit_questions(id) on delete cascade,
  owner_department text not null check (owner_department in ('it', 'engineering')),
  title text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  resolution_comment text null,
  ready_for_reaudit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audit_run_id, question_id, owner_department)
);

create index if not exists department_backlog_items_hotel_department_status_idx
on public.department_backlog_items (hotel_id, owner_department, status);

create index if not exists department_backlog_items_area_idx
on public.department_backlog_items (area_id);

create index if not exists department_backlog_items_run_idx
on public.department_backlog_items (audit_run_id);

insert into public.department_backlog_items (
  hotel_id,
  area_id,
  audit_run_id,
  question_id,
  owner_department,
  title,
  status,
  resolution_comment,
  ready_for_reaudit,
  created_at,
  updated_at
)
select distinct
  r.hotel_id,
  r.area_id,
  r.id,
  q.id,
  case
    when q.owner_department = 'systems' then 'it'
    else q.owner_department
  end as owner_department,
  q.text,
  'open',
  null,
  false,
  coalesce(r.executed_at, now()),
  now()
from public.audit_runs r
join public.audit_answers a
  on a.audit_run_id = r.id
join public.audit_questions q
  on q.id = a.question_id
where r.status = 'submitted'
  and upper(coalesce(a.result, a.answer, '')) = 'FAIL'
  and coalesce(q.owner_department, '') in ('it', 'systems', 'engineering')
on conflict (audit_run_id, question_id, owner_department) do nothing;
