"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ fallback = "/dashboard" }: { fallback?: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        try {
          router.back();
          // si no hay historial real, en algunos casos no vuelve, así que además:
          setTimeout(() => router.push(fallback), 120);
        } catch {
          router.push(fallback);
        }
      }}
      style={{
        position: "fixed",
        top: 76, // debajo del header
        left: 18,
        zIndex: 9998,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(0,0,0,0.55)",
        color: "#fff",
        fontWeight: 950,
        cursor: "pointer",
        boxShadow: "0 12px 34px rgba(0,0,0,0.25)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.70)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.55)")}
      aria-label="Atrás"
      title="Atrás"
    >
      ← Atrás
    </button>
  );
}
