// FILE: app/superadmin/templates/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";

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

      const p = await requireRoleOrRedirect(router, ["superadmin"], "/dashboard");
      if (!p) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        // ✅ Crear GLOBAL (NO hotel_id)
        const { data: created, error: cErr } = await supabase
          .from("audit_templates")
          .insert({
            name: "Nueva plantilla global",
            scope: "global",
            active: true,
            area_id: null,
          })
          .select("id")
          .single();

        if (cErr || !created?.id) throw cErr ?? new Error("No se pudo crear la plantilla global.");

        // ✅ Ir directo al builder global (tu ruta existente)
        router.replace(`/superadmin/templates/${created.id}`);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Error creando la plantilla global.");
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

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