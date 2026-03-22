-- Archiving: soft-delete for old audit_runs
-- Adds archived_at column and a function to archive old completed runs.

-- 1. Add archive column
alter table public.audit_runs
  add column if not exists archived_at timestamptz default null;

-- 2. Index for filtering archived runs
create index if not exists idx_audit_runs_archived
  on public.audit_runs (archived_at)
  where archived_at is null;

-- 3. RPC to archive runs older than N days (default 180)
create or replace function public.archive_old_audit_runs(
  p_hotel_id uuid,
  p_older_than_days int default 180
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_cutoff timestamptz;
  v_count int;
begin
  v_cutoff := now() - (p_older_than_days || ' days')::interval;

  update public.audit_runs
  set archived_at = now()
  where hotel_id = p_hotel_id
    and status = 'submitted'
    and archived_at is null
    and executed_at < v_cutoff
    -- Don't archive if it has unresolved child reaudits
    and not exists (
      select 1
      from public.audit_runs child
      where child.parent_audit_run_id = audit_runs.id
        and child.status = 'draft'
    );

  get diagnostics v_count = row_count;

  return jsonb_build_object(
    'archived_count', v_count,
    'cutoff_date', v_cutoff
  );
end;
$$;

-- 4. RPC to restore a single archived run
create or replace function public.restore_audit_run(
  p_run_id uuid,
  p_hotel_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  update public.audit_runs
  set archived_at = null
  where id = p_run_id
    and hotel_id = p_hotel_id
    and archived_at is not null;

  if not found then
    raise exception 'Run not found or not archived';
  end if;
end;
$$;
