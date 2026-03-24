"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 40, textAlign: "center" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Algo salió mal</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Se ha producido un error inesperado. El equipo técnico ha sido notificado.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 20px",
          backgroundColor: "#2563eb",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        Reintentar
      </button>
    </div>
  );
}
