-- In-app notifications for corrective actions, reaudits, etc.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id),
  user_id uuid not null references auth.users(id),
  type text not null, -- 'corrective_action', 'reaudit_assigned', 'reaudit_ready', 'training_required'
  title text not null,
  body text,
  link text, -- relative URL to navigate to
  read_at timestamptz default null,
  created_at timestamptz default now()
);

-- Index for fast unread count
create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists idx_notifications_hotel
  on public.notifications (hotel_id);

-- RLS
alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Helper: create notification for a user
create or replace function public.notify_user(
  p_hotel_id uuid,
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (hotel_id, user_id, type, title, body, link)
  values (p_hotel_id, p_user_id, p_type, p_title, p_body, p_link)
  returning id into v_id;

  return v_id;
end;
$$;

-- Auto-notify on corrective action creation
create or replace function public.trg_notify_corrective_action()
returns trigger
language plpgsql
security definer
as $$
declare
  v_run record;
  v_area_name text;
begin
  -- Get audit run info
  select r.hotel_id, r.area_id, r.executed_by
  into v_run
  from public.audit_runs r
  where r.id = NEW.audit_run_id;

  if v_run is null then return NEW; end if;

  select name into v_area_name
  from public.areas
  where id = v_run.area_id;

  -- Notify the auditor who executed the audit
  if v_run.executed_by is not null then
    perform public.notify_user(
      v_run.hotel_id,
      v_run.executed_by,
      'corrective_action',
      'Nueva acción correctiva',
      'Se creó una acción correctiva en ' || coalesce(v_area_name, 'un área'),
      '/audits/' || NEW.audit_run_id || '/view'
    );
  end if;

  return NEW;
end;
$$;

create trigger trg_notify_on_corrective_action
  after insert on public.audit_corrective_actions
  for each row
  execute function public.trg_notify_corrective_action();

-- Auto-notify on reaudit assignment
create or replace function public.trg_notify_reaudit_assigned()
returns trigger
language plpgsql
security definer
as $$
declare
  v_area_name text;
begin
  -- Only fire for new reaudits
  if NEW.is_reaudit is not true then return NEW; end if;
  if NEW.assigned_auditor_id is null then return NEW; end if;

  select a.name into v_area_name
  from public.areas a
  where a.id = NEW.area_id;

  perform public.notify_user(
    NEW.hotel_id,
    NEW.assigned_auditor_id,
    'reaudit_assigned',
    'Reauditoría asignada',
    'Tienes una reauditoría pendiente en ' || coalesce(v_area_name, 'un área'),
    '/audits/' || NEW.id
  );

  return NEW;
end;
$$;

create trigger trg_notify_on_reaudit_assigned
  after insert on public.audit_runs
  for each row
  when (NEW.is_reaudit = true and NEW.assigned_auditor_id is not null)
  execute function public.trg_notify_reaudit_assigned();
