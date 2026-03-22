create or replace function public.start_append_note(
  p_existing text,
  p_block text
)
returns text
language sql
immutable
as $$
  select
    case
      when nullif(btrim(coalesce(p_block, '')), '') is null then p_existing
      when nullif(btrim(coalesce(p_existing, '')), '') is null then nullif(btrim(coalesce(p_block, '')), '')
      else p_existing || E'\n\n' || nullif(btrim(coalesce(p_block, '')), '')
    end
$$;
