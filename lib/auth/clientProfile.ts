"use client";

import { normalizeRole } from "@/lib/auth/permissions";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/types";

export async function getClientProfile(): Promise<Profile | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, hotel_id, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) return null;
  if (profile.active === false) return null;

  return {
    id: profile.id,
    full_name: profile.full_name ?? null,
    role: normalizeRole(profile.role),
    hotel_id: profile.hotel_id ?? null,
    active: profile.active ?? null,
  };
}
