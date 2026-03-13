alter table public.profiles
add column if not exists employee_number text;

create unique index if not exists profiles_hotel_employee_number_unique
on public.profiles (hotel_id, employee_number)
where employee_number is not null and btrim(employee_number) <> '';

create table if not exists public.training_topics (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  title text not null,
  description text null,
  qr_token text not null unique,
  is_active boolean not null default true,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_topics_hotel_id_idx
on public.training_topics (hotel_id, created_at desc);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  topic_id uuid not null references public.training_topics(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_by_profile_id uuid null references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_by_profile_id uuid null references public.profiles(id) on delete set null,
  closed_at timestamptz null,
  supervisor_name_snapshot text null,
  session_label text null
);

create index if not exists training_sessions_topic_status_idx
on public.training_sessions (topic_id, status, opened_at desc);

create index if not exists training_sessions_hotel_status_idx
on public.training_sessions (hotel_id, status, opened_at desc);

create table if not exists public.training_attendances (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  topic_id uuid not null references public.training_topics(id) on delete cascade,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  employee_profile_id uuid not null references public.profiles(id) on delete restrict,
  employee_number text not null,
  employee_name_input text null,
  checked_in_at timestamptz not null default now()
);

create unique index if not exists training_attendances_session_employee_unique
on public.training_attendances (session_id, employee_profile_id);

create index if not exists training_attendances_session_idx
on public.training_attendances (session_id, checked_in_at desc);

create index if not exists training_attendances_topic_idx
on public.training_attendances (topic_id, checked_in_at desc);

alter table public.training_topics enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_attendances enable row level security;
