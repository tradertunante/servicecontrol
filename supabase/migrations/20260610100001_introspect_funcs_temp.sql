-- TEMPORAL (introspección): devuelve el source de funciones helper para auditar
-- los predicados de RLS. Se elimina en la migración de fix.
create or replace function public._sc_dump_funcs(p_names text[])
returns jsonb
language sql
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('name', p.proname, 'def', pg_get_functiondef(p.oid))
      order by p.proname
    ),
    '[]'::jsonb
  )
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(p_names);
$$;