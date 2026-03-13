-- Compatibility overload for rpc_team_summary
-- Purpose:
-- allow clients/schema cache expecting argument order
-- (p_hotel_id uuid, p_period text, p_user_id uuid)
-- while delegating to the canonical implementation
-- (p_hotel_id uuid, p_user_id uuid, p_period text).

create or replace function public.rpc_team_summary(
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
