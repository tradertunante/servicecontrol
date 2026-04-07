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

      // Only sync when there IS a session — never clear the cookie here.
      // The cookie has its own expiry and is cleared explicitly on logout.
      if (data.session?.access_token) {
        syncCookie(data.session.access_token, data.session.expires_at ?? null);
      }
    };

    void syncSessionCookie();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        // Refresh or sign-in: update the cookie with the new token
        syncCookie(session.access_token, session.expires_at ?? null);
      } else if (event === "SIGNED_OUT") {
        // Only clear the cookie on explicit sign-out
        clearCookie();
      }
      // INITIAL_SESSION with null session: do nothing — leave existing cookie intact
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
