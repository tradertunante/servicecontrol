create or replace function public.set_user_area_access_atomic(
  p_user_id uuid,
  p_hotel_id uuid,
  p_area_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_distinct_area_ids uuid[] := array[]::uuid[];
  v_valid_count integer := 0;
begin
  begin
    if p_user_id is null or p_hotel_id is null then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'user_id y hotel_id son obligatorios.');
    end if;

    select coalesce(array_agg(distinct area_id), array[]::uuid[])
    into v_distinct_area_ids
    from unnest(coalesce(p_area_ids, array[]::uuid[])) as area_id;

    if coalesce(array_length(v_distinct_area_ids, 1), 0) > 0 then
      select count(*)::int
      into v_valid_count
      from public.areas
      where hotel_id = p_hotel_id
        and id = any(v_distinct_area_ids);

      if v_valid_count <> coalesce(array_length(v_distinct_area_ids, 1), 0) then
        return jsonb_build_object('ok', false, 'code', 'INVALID_AREAS', 'message', 'Hay áreas que no pertenecen al hotel seleccionado.');
      end if;
    end if;

    delete from public.user_area_access
    where hotel_id = p_hotel_id
      and user_id = p_user_id;

    if coalesce(array_length(v_distinct_area_ids, 1), 0) > 0 then
      insert into public.user_area_access (user_id, area_id, hotel_id)
      select p_user_id, area_id, p_hotel_id
      from unnest(v_distinct_area_ids) as area_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'code', 'AREA_ACCESS_UPDATED',
      'data', jsonb_build_object(
        'count', coalesce(array_length(v_distinct_area_ids, 1), 0)
      )
    );
  exception
    when others then
      return jsonb_build_object('ok', false, 'code', 'INTERNAL_ERROR', 'message', sqlerrm);
  end;
end;
$$;
