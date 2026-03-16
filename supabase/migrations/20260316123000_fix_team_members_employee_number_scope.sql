do $$
declare
  constraint_name text;
  index_name text;
  key_columns text[];
begin
  for constraint_name, key_columns in
    select
      con.conname,
      array_agg(att.attname order by cols.ordinality) as key_columns
    from pg_constraint con
    join pg_class rel
      on rel.oid = con.conrelid
    join pg_namespace nsp
      on nsp.oid = rel.relnamespace
    join unnest(con.conkey) with ordinality as cols(attnum, ordinality)
      on true
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = cols.attnum
    where nsp.nspname = 'public'
      and rel.relname = 'team_members'
      and con.contype = 'u'
    group by con.conname
  loop
    if key_columns = array['employee_number'] then
      execute format(
        'alter table public.team_members drop constraint if exists %I',
        constraint_name
      );
    end if;
  end loop;

  for index_name in
    select idx.indexname
    from pg_indexes idx
    where idx.schemaname = 'public'
      and idx.tablename = 'team_members'
      and idx.indexdef ilike 'create unique index%'
      and idx.indexdef ilike '%(employee_number)%'
      and idx.indexdef not ilike '%(hotel_id, employee_number)%'
  loop
    execute format('drop index if exists public.%I', index_name);
  end loop;
end
$$;

drop index if exists public.team_members_hotel_employee_number_unique;

create unique index if not exists team_members_hotel_employee_number_unique
on public.team_members (hotel_id, employee_number)
where employee_number is not null
  and btrim(employee_number) <> '';
