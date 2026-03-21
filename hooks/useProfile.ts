"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type { Profile, Role } from "@/lib/types";

async function fetchProfile(): Promise<Profile | null> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return null;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, hotel_id, active")
    .eq("id", userData.user.id)
    .single();

  if (profileErr || !profile) return null;

  return {
    id: profile.id,
    full_name: profile.full_name ?? null,
    role: (profile.role ?? "") as Role,
    hotel_id: profile.hotel_id ?? null,
    active: profile.active ?? null,
  };
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });
}
