import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { setActiveHotel } from "./auth/activeHotelClient";
import { supabase } from "./supabaseClient";

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function signOutAndRedirect(router: AppRouterInstance) {
  try {
    await setActiveHotel(null);
  } catch (error) {
    console.warn("Could not clear active hotel during logout:", error);
  }

  try {
    await supabase.auth.signOut();
  } finally {
    // Clear httpOnly auth cookie server-side
    fetch("/api/auth/sync-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: null }),
    }).catch(() => {});

    router.replace("/login");
    router.refresh();
  }
}
