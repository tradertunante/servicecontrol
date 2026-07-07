"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CONSENT_COOKIE, getStoredConsent, initPostHog } from "@/app/providers/PostHogProvider";

function setConsentCookie(value: "granted" | "denied") {
  const maxAge = 365 * 24 * 60 * 60;
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getStoredConsent() === null) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function accept() {
    setConsentCookie("granted");
    initPostHog();
    setVisible(false);
  }

  function decline() {
    setConsentCookie("denied");
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        width: "calc(100% - 32px)",
        maxWidth: 560,
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 16,
        boxShadow: "0 8px 40px rgba(0,0,0,0.14)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#333" }}>
        Usamos cookies analíticas (PostHog) para mejorar el producto. No vendemos tus datos.{" "}
        <Link href="/cookies" style={{ color: "#000", fontWeight: 600, textDecoration: "underline" }}>
          Política de cookies
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" style={{ color: "#000", fontWeight: 600, textDecoration: "underline" }}>
          Privacidad
        </Link>
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={decline}
          style={{
            padding: "8px 18px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "#fff",
            color: "#333",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Rechazar
        </button>
        <button
          onClick={accept}
          style={{
            padding: "8px 18px",
            borderRadius: 10,
            border: "none",
            background: "#0C1F44",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}