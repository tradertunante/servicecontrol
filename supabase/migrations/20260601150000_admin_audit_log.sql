-- Admin audit log: records every privileged action on users
-- (create, role change, active toggle, delete).
-- Accessed only via service_role; no RLS needed.

create table if not exists public.admin_audit_log (
  id          uuid        primary key default gen_random_uuid(),
  hotel_id    uuid        references public.hotels(id) on delete cascade,
  actor_id    uuid,
  actor_name  text,
  target_id   uuid,
  target_name text,
  action      text        not null,   -- user_created | role_changed | active_changed | user_deleted
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_hotel_created_idx
  on public.admin_audit_log (hotel_id, created_at desc);