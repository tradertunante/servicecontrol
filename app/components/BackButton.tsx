"use client";

import { useRouter } from "next/navigation";
import { goBackOrFallback } from "@/lib/navigation/clientBack";

export default function BackButton({ fallback = "/dashboard" }: { fallback?: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        goBackOrFallback(router, fallback);
      }}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white font-extrabold"
      aria-label="Atrás"
      title="Atrás"
    >
      ← Atrás
    </button>
  );
}
