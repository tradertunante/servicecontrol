"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ fallback }: { fallback?: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        // intenta volver atrás; si no, usa fallback
        if (window.history.length > 1) router.back();
        else router.push(fallback ?? "/");
      }}
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.2)",
        background: "#fff",
        fontWeight: 900,
        cursor: "pointer",
        marginBottom: 14,
      }}
    >
      ← Atrás
    </button>
  );
}
