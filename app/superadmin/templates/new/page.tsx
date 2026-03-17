// FILE: app/superadmin/templates/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HotelHeader from "@/app/components/HotelHeader";
import { fetchJsonOrThrow } from "@/lib/superadmin/clientApi";

export default function SuperadminCreateGlobalTemplatePage() {
  const router = useRouter();
  const sp = useSearchParams();

  // opcional: por si algún sitio te manda ?back=
  const back = sp.get("back") || "/superadmin/templates";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const created = await fetchJsonOrThrow<{ template_id: string }>("/api/superadmin/templates", {
          method: "POST",
          body: JSON.stringify({ name: "Nueva plantilla global" }),
        });

        // ✅ Ir directo al builder global (tu ruta existente)
        router.replace(`/superadmin/templates/${created.template_id}`);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Error creando la plantilla global.");
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [back, router]);

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <HotelHeader />

      {loading ? <p style={{ opacity: 0.8 }}>Creando plantilla global…</p> : null}

      {error ? (
        <div style={{ marginTop: 12, color: "crimson", fontWeight: 900, whiteSpace: "pre-wrap" }}>
          {error}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => router.push(back)}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.2)",
                background: "#fff",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              ← Atrás
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
