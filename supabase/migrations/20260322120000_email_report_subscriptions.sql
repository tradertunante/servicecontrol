-- Email report subscriptions: who receives weekly/monthly reports
create table if not exists public.report_subscriptions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id),
  user_id uuid not null references auth.users(id),
  report_type text not null check (report_type in ('weekly', 'monthly')),
  email text not null,
  active boolean default true,
  created_at timestamptz default now(),
  unique (hotel_id, user_id, report_type)
);

alter table public.report_subscriptions enable row level security;

create policy "Admins can manage subscriptions"
  on public.report_subscriptions for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = report_subscriptions.hotel_id
        and p.role in ('superadmin', 'admin')
    )
  );

create index idx_report_subscriptions_hotel
  on public.report_subscriptions (hotel_id, report_type)
  where active = true;
