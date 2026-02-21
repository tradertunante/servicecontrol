"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";

const HOTEL_KEY = "sc_hotel_id"; // el mismo que usas para hotel activo

export default function SuperadminCreateTemplatePage() {
  const router = useRouter();
  const sp = useSearchParams();

  const back = sp.get("back") || "/superadmin/templates";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);

      const p = await requireRoleOrRedirect(router, ["superadmin"], "/dashboard");
      if (!p) return;

      try {
        // ✅ 1) Sacar hotel_id desde localStorage (evita RLS de hotels)
        const hotelId =
          typeof window !== "undefined" ? window.localStorage.getItem(HOTEL_KEY) : null;

        if (!hotelId) {
          throw new Error(
            "No hay hotel activo seleccionado (sc_hotel_id). Ve a Superadmin → Hoteles y selecciona uno, o entra al sistema y elige hotel primero."
          );
        }

        // ✅ 2) Crear plantilla cumpliendo el CHECK (scope='hotel' requiere hotel_id)
        const { data: created, error: cErr } = await supabase
          .from("audit_templates")
          .insert({
            name: "Nueva plantilla",
            scope: "hotel",
            hotel_id: hotelId,
            active: true,
            area_id: null,
          })
          .select("id")
          .single();

        if (cErr || !created?.id) throw cErr ?? new Error("No se pudo crear la plantilla.");

        // ✅ 3) Ir DIRECTO a importar excel (saltamos pantallas intermedias)
        router.replace(
          `/superadmin/templates/${created.id}/import?back=${encodeURIComponent(back)}`
        );
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Error creando la plantilla.");
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router, back]);

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <HotelHeader />

      {loading ? <p style={{ opacity: 0.8 }}>Creando plantilla…</p> : null}

      {error ? (
        <div style={{ marginTop: 12, color: "crimson", fontWeight: 900 }}>
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
              Volver
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}