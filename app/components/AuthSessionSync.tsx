"use client";

import { useEffect } from "react";

import { supabase } from "@/lib/supabaseClient";

async function syncCookie(token: string, expiresAt?: number | null) {
  try {
    await fetch("/api/auth/sync-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token || null, expires_at: expiresAt ?? null }),
    });
  } catch {
    // Network error — cookie will be stale but next page load retries
  }
}

async function clearCookie() {
  return syncCookie("");
}

export default function AuthSessionSync() {
  useEffect(() => {
    let mounted = true;

    const syncSessionCookie = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const token = data.session?.access_token ?? "";
      if (!token) {
        clearCookie();
        return;
      }

      syncCookie(token, data.session?.expires_at ?? null);
    };

    void syncSessionCookie();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        syncCookie(session.access_token, session.expires_at ?? null);
      } else {
        clearCookie();
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
