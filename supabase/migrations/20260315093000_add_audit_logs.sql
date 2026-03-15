create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  actor_user_id uuid null references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  old_value jsonb null,
  new_value jsonb null,
  metadata jsonb null,
  created_at timestamptz not null default now(),
  constraint audit_logs_entity_type_not_blank check (length(trim(entity_type)) > 0),
  constraint audit_logs_action_not_blank check (length(trim(action)) > 0),
  constraint audit_logs_entity_id_not_blank check (length(trim(entity_id)) > 0)
);

create index if not exists audit_logs_hotel_created_at_idx
on public.audit_logs (hotel_id, created_at desc);

create index if not exists audit_logs_entity_idx
on public.audit_logs (entity_type, entity_id);

create index if not exists audit_logs_created_at_desc_idx
on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;
