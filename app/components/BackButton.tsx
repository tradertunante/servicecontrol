"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ fallback = "/dashboard" }: { fallback?: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        try {
          router.back();
          setTimeout(() => router.push(fallback), 120);
        } catch {
          router.push(fallback);
        }
      }}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white font-extrabold"
      aria-label="Atrás"
      title="Atrás"
    >
      ← Atrás
    </button>
  );
}