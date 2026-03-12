drop function if exists public.rpc_team_summary_v2(uuid, text, uuid);

create or replace function public.rpc_team_summary_v2(
  p_hotel_id uuid,
  p_period text,
  p_user_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.rpc_team_summary(
    p_hotel_id,
    p_user_id,
    p_period
  );
$$;
