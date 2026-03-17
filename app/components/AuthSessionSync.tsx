"use client";

import { useEffect } from "react";

import { supabase } from "@/lib/supabaseClient";
import { AUTH_TOKEN_COOKIE } from "@/lib/auth/cookies";

function setCookie(name: string, value: string, expiresAtSeconds?: number | null) {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  const expires =
    typeof expiresAtSeconds === "number" && Number.isFinite(expiresAtSeconds)
      ? `; Expires=${new Date(expiresAtSeconds * 1000).toUTCString()}`
      : "";

  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${secure}${expires}`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export default function AuthSessionSync() {
  useEffect(() => {
    let mounted = true;

    const syncSessionCookie = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const token = data.session?.access_token ?? "";
      if (!token) {
        clearCookie(AUTH_TOKEN_COOKIE);
        return;
      }

      setCookie(AUTH_TOKEN_COOKIE, token, data.session?.expires_at ?? null);
    };

    void syncSessionCookie();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        setCookie(AUTH_TOKEN_COOKIE, session.access_token, session.expires_at ?? null);
      } else {
        clearCookie(AUTH_TOKEN_COOKIE);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
