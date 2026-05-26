-- AI-generated narrative summaries for weekly and monthly reports.
-- One row per hotel per period. Cached to avoid re-generating on every email send.

create table if not exists public.report_narratives (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  period_type text not null check (period_type in ('weekly', 'monthly')),
  period_label text not null,            -- e.g. "19 may - 26 may 2026" or "mayo 2026"
  period_start timestamptz not null,
  period_end timestamptz not null,
  narrative_hotel text not null,         -- hotel-level summary (for QM + GM)
  narrative_areas jsonb not null default '{}', -- { area_id: narrative_text }
  overall_score numeric(5,2),
  prev_overall_score numeric(5,2),
  total_audits int,
  created_at timestamptz not null default now()
);

create index if not exists idx_report_narratives_hotel_period
  on public.report_narratives (hotel_id, period_type, period_start desc);

-- RLS: visible to hotel staff with reporting roles
alter table public.report_narratives enable row level security;

create policy "Report narratives visible to hotel staff"
  on public.report_narratives for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = report_narratives.hotel_id
        and p.role in ('admin', 'quality', 'general_manager', 'manager')
    )
  );

create policy "Service role manages report narratives"
  on public.report_narratives for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');