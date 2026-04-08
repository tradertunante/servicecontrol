-- Per-hotel toggles for transactional email notifications.
-- All writes go through supabaseAdmin (bypasses RLS). RLS is a safety net
-- in case any client-side access is ever added.

create table public.hotel_notification_settings (
  id          uuid        primary key default gen_random_uuid(),
  hotel_id    uuid        not null unique references public.hotels(id) on delete cascade,
  new_user_email_enabled                   boolean not null default true,
  quality_audit_submitted_email_enabled    boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.hotel_notification_settings enable row level security;

-- Admins/managers of the hotel can read and write their own settings.
create policy "Hotel admins can manage notification settings"
  on public.hotel_notification_settings for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = hotel_notification_settings.hotel_id
        and p.role in ('superadmin', 'admin', 'general_manager')
    )
  );

-- Keep updated_at in sync automatically.
create or replace function public.trg_set_notification_settings_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

create trigger trg_hotel_notification_settings_updated_at
  before update on public.hotel_notification_settings
  for each row execute function public.trg_set_notification_settings_updated_at();
