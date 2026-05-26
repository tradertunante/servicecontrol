-- AI-generated training suggestions, pending manager review before becoming real training topics.

create table if not exists public.ai_training_suggestions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete cascade,
  question_id uuid references public.audit_questions(id) on delete set null,
  question_text text not null,
  trigger_ratio float not null,      -- failure ratio that triggered the suggestion
  trigger_count int not null,        -- number of failures in the period
  trigger_period_days int not null,  -- analysis window in days
  ai_content jsonb not null,         -- { objective, procedure[], checklist[], questions[] }
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected', 'realized')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  approved_at timestamptz,
  realized_at timestamptz,
  topic_id uuid references public.training_topics(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_training_suggestions_hotel
  on public.ai_training_suggestions (hotel_id, review_status, created_at desc);

create index if not exists idx_ai_training_suggestions_area
  on public.ai_training_suggestions (area_id, review_status);

-- RLS: managers see their own area's suggestions; admin/quality/gm see all hotel suggestions
alter table public.ai_training_suggestions enable row level security;

create policy "Training suggestions visible to hotel staff"
  on public.ai_training_suggestions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = ai_training_suggestions.hotel_id
        and p.role in ('admin', 'quality', 'general_manager', 'manager')
    )
  );

-- Only service role (API routes) can insert/update
create policy "Service role manages suggestions"
  on public.ai_training_suggestions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');