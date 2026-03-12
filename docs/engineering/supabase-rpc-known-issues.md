# Supabase RPC Known Issues

## Supabase RPC "function not found in schema cache"

### Problem

During development we encountered the error:

Could not find the function public.rpc_team_summary(p_hotel_id, p_period, p_user_id) in the schema cache

This happens when PostgREST cannot resolve the exact RPC signature.

Typical causes:

- The function does not exist in the database
- Parameter order differs from the RPC call
- Overloaded functions confuse PostgREST
- Schema cache not refreshed
- Frontend calling an outdated RPC name

### Symptoms

UI error example:

Error: Could not find the function public.rpc_team_summary(p_hotel_id, p_period, p_user_id)

SQL error example:

ERROR: function public.rpc_team_summary(uuid, uuid, text) does not exist

### Root Cause in ServiceControl

The production database was missing the canonical function:

`rpc_team_summary(
  p_hotel_id uuid,
  p_user_id uuid,
  p_period text
)`

The frontend expected a different parameter order.

### Solution Applied

We implemented a stable adapter RPC:

`rpc_team_summary_v2(
  p_hotel_id uuid,
  p_period text,
  p_user_id uuid
)`

Which internally calls the canonical function:

```sql
select public.rpc_team_summary(
  p_hotel_id,
  p_user_id,
  p_period
);
```

Frontend now always calls:

`supabase.rpc("rpc_team_summary_v2", { ... })`

This avoids PostgREST overload resolution problems.

### Best Practices Going Forward

For all RPCs in ServiceControl:

1. Avoid overloaded function names
2. Prefer stable wrapper RPCs if parameter order changes
3. Keep canonical logic in a single internal function
4. Frontend must call only the stable RPC interface
5. Always deploy database migrations before frontend changes
