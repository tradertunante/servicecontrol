create or replace function public.sc_can_view_global_library_assets()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sc_user_role() = any(array['superadmin', 'admin']);
$$;

create or replace function public.sc_can_manage_global_library_assets()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sc_user_role() = 'superadmin';
$$;

create table if not exists public.training_registration_tokens (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  topic_id uuid not null references public.training_topics(id) on delete cascade,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  token_nonce_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists training_registration_tokens_session_idx
on public.training_registration_tokens (session_id, expires_at desc);

alter table public.training_registration_tokens enable row level security;

do $$
begin
  if to_regclass('public.global_audit_packs') is not null then
    execute 'alter table public.global_audit_packs enable row level security';
    execute 'drop policy if exists global_audit_packs_select_scoped on public.global_audit_packs';
    execute 'create policy global_audit_packs_select_scoped on public.global_audit_packs for select to authenticated using (public.sc_can_view_global_library_assets())';
    execute 'drop policy if exists global_audit_packs_mutate_superadmin on public.global_audit_packs';
    execute 'create policy global_audit_packs_mutate_superadmin on public.global_audit_packs for all to authenticated using (public.sc_can_manage_global_library_assets()) with check (public.sc_can_manage_global_library_assets())';
  end if;

  if to_regclass('public.global_audit_pack_templates') is not null then
    execute 'alter table public.global_audit_pack_templates enable row level security';
    execute 'drop policy if exists global_audit_pack_templates_select_scoped on public.global_audit_pack_templates';
    execute 'create policy global_audit_pack_templates_select_scoped on public.global_audit_pack_templates for select to authenticated using (public.sc_can_view_global_library_assets())';
    execute 'drop policy if exists global_audit_pack_templates_mutate_superadmin on public.global_audit_pack_templates';
    execute 'create policy global_audit_pack_templates_mutate_superadmin on public.global_audit_pack_templates for all to authenticated using (public.sc_can_manage_global_library_assets()) with check (public.sc_can_manage_global_library_assets())';
  end if;

  if to_regclass('public.standard_libraries') is not null then
    execute 'alter table public.standard_libraries enable row level security';
    execute 'drop policy if exists standard_libraries_select_scoped on public.standard_libraries';
    execute 'create policy standard_libraries_select_scoped on public.standard_libraries for select to authenticated using (public.sc_can_view_global_library_assets())';
    execute 'drop policy if exists standard_libraries_mutate_superadmin on public.standard_libraries';
    execute 'create policy standard_libraries_mutate_superadmin on public.standard_libraries for all to authenticated using (public.sc_can_manage_global_library_assets()) with check (public.sc_can_manage_global_library_assets())';
  end if;

  if to_regclass('public.standard_templates') is not null then
    execute 'alter table public.standard_templates enable row level security';
    execute 'drop policy if exists standard_templates_select_scoped on public.standard_templates';
    execute 'create policy standard_templates_select_scoped on public.standard_templates for select to authenticated using (public.sc_can_view_global_library_assets())';
    execute 'drop policy if exists standard_templates_mutate_superadmin on public.standard_templates';
    execute 'create policy standard_templates_mutate_superadmin on public.standard_templates for all to authenticated using (public.sc_can_manage_global_library_assets()) with check (public.sc_can_manage_global_library_assets())';
  end if;

  if to_regclass('public.standard_sections') is not null then
    execute 'alter table public.standard_sections enable row level security';
    execute 'drop policy if exists standard_sections_select_scoped on public.standard_sections';
    execute 'create policy standard_sections_select_scoped on public.standard_sections for select to authenticated using (public.sc_can_view_global_library_assets())';
    execute 'drop policy if exists standard_sections_mutate_superadmin on public.standard_sections';
    execute 'create policy standard_sections_mutate_superadmin on public.standard_sections for all to authenticated using (public.sc_can_manage_global_library_assets()) with check (public.sc_can_manage_global_library_assets())';
  end if;

  if to_regclass('public.standard_questions') is not null then
    execute 'alter table public.standard_questions enable row level security';
    execute 'drop policy if exists standard_questions_select_scoped on public.standard_questions';
    execute 'create policy standard_questions_select_scoped on public.standard_questions for select to authenticated using (public.sc_can_view_global_library_assets())';
    execute 'drop policy if exists standard_questions_mutate_superadmin on public.standard_questions';
    execute 'create policy standard_questions_mutate_superadmin on public.standard_questions for all to authenticated using (public.sc_can_manage_global_library_assets()) with check (public.sc_can_manage_global_library_assets())';
  end if;

  if to_regclass('public.tasks') is not null then
    execute 'alter table public.tasks enable row level security';
    execute 'drop policy if exists tasks_select_assigned_only on public.tasks';
    execute $policy$
      create policy tasks_select_assigned_only
      on public.tasks
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.task_assignments ta
          where ta.task_id = tasks.id
            and ta.user_id = auth.uid()
        )
      )
    $policy$;
  end if;

  if to_regclass('public.task_assignments') is not null then
    execute 'alter table public.task_assignments enable row level security';
    execute 'drop policy if exists task_assignments_select_self on public.task_assignments';
    execute 'create policy task_assignments_select_self on public.task_assignments for select to authenticated using (user_id = auth.uid())';
  end if;
end
$$;
