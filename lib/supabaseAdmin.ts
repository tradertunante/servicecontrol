// lib/supabaseAdmin.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/config";

export function supabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseConfig.url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}