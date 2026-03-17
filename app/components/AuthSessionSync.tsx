"use client";

import { useEffect } from "react";

import { supabase } from "@/lib/supabaseClient";
import { AUTH_TOKEN_COOKIE, HOTEL_SCOPE_COOKIE } from "@/lib/auth/cookies";

const HOTEL_KEY = "sc_hotel_id";
const HOTEL_CHANGED_EVENT = "sc-hotel-changed";

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

function syncHotelScopeCookie() {
  try {
    const hotelId = window.localStorage.getItem(HOTEL_KEY);
    if (hotelId) {
      setCookie(HOTEL_SCOPE_COOKIE, hotelId);
      return;
    }
  } catch {}

  clearCookie(HOTEL_SCOPE_COOKIE);
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
    syncHotelScopeCookie();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        setCookie(AUTH_TOKEN_COOKIE, session.access_token, session.expires_at ?? null);
      } else {
        clearCookie(AUTH_TOKEN_COOKIE);
      }
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key === HOTEL_KEY) syncHotelScopeCookie();
    };

    const onHotelChanged = () => syncHotelScopeCookie();

    window.addEventListener("storage", onStorage);
    window.addEventListener(HOTEL_CHANGED_EVENT, onHotelChanged as EventListener);

    const interval = window.setInterval(syncHotelScopeCookie, 1000);

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(HOTEL_CHANGED_EVENT, onHotelChanged as EventListener);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
