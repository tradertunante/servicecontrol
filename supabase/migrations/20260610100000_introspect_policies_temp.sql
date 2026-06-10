-- TEMPORAL (introspección): expone pg_policies del schema public para auditar
-- el solapamiento de policies legacy permisivas con las sc_* del hardening.
-- Esta función se elimina en la migración de fix que le sigue.
create or replace function public._sc_dump_policies()
returns jsonb
language sql
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'tablename', tablename,
        'policyname', policyname,
        'permissive', permissive,
        'roles', roles,
        'cmd', cmd,
        'qual', qual,
        'with_check', with_check
      )
      order by tablename, policyname
    ),
    '[]'::jsonb
  )
  from pg_policies
  where schemaname = 'public';
$$;