-- Redesign report_subscriptions for granular control:
-- - frequency: instant (on submit), weekly, monthly
-- - scope: all_areas, my_areas (user's assigned areas), specific_areas
-- - channel: all, quality, internal
-- - area_ids: for specific_areas scope

-- Drop old simple table and recreate
drop table if exists public.report_subscriptions;

create table public.report_subscriptions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id),
  email text not null,
  frequency text not null check (frequency in ('instant', 'weekly', 'monthly')),
  scope text not null default 'all_areas' check (scope in ('all_areas', 'my_areas', 'specific_areas')),
  area_ids uuid[] default null, -- only used when scope = 'specific_areas'
  channel text not null default 'all' check (channel in ('all', 'quality', 'internal')),
  active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table public.report_subscriptions enable row level security;

create policy "Admins can manage subscriptions"
  on public.report_subscriptions for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = report_subscriptions.hotel_id
        and p.role in ('superadmin', 'admin', 'general_manager', 'quality')
    )
  );

create index idx_report_subs_hotel_freq
  on public.report_subscriptions (hotel_id, frequency)
  where active = true;

create index idx_report_subs_instant
  on public.report_subscriptions (hotel_id)
  where active = true and frequency = 'instant';
