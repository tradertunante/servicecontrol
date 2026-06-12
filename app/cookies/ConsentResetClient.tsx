"use client";

import { CONSENT_COOKIE } from "@/app/providers/PostHogProvider";

export default function ConsentResetClient() {
  function reset() {
    document.cookie = `${CONSENT_COOKIE}=; path=/; max-age=0`;
    window.location.reload();
  }

  return (
    <button
      onClick={reset}
      style={{
        marginTop: 8,
        padding: "9px 20px",
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.2)",
        background: "#fff",
        color: "#111",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      Cambiar preferencias de cookies
    </button>
  );
}