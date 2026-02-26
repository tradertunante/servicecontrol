// app/(app)/admin/_modules/area-audits/AreaAuditsModule.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Audit = {
  id: string;
  name: string;
};

export default function AreaAuditsModule({
  hotelId,
  areaId,
  areaName,
}: {
  hotelId: string;
  areaId: string | null;
  areaName: string | null;
}) {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const title = useMemo(() => {
    if (!areaId) return "Auditorías";
    return areaName ? `Auditorías · ${areaName}` : "Auditorías";
  }, [areaId, areaName]);

  useEffect(() => {
    let alive = true;

    async function loadAudits() {
      setError("");
      setAudits([]);

      if (!hotelId) return;
      if (!areaId) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("audit_templates")
          .select("id, name")
          .eq("hotel_id", hotelId)
          .eq("area_id", areaId)
          .order("name", { ascending: true });

        if (error) throw error;

        if (!alive) return;
        setAudits((data ?? []) as any);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Error cargando auditorías.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadAudits();

    return () => {
      alive = false;
    };
  }, [hotelId, areaId]);

  async function reload() {
    if (!hotelId || !areaId) return;

    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("audit_templates")
        .select("id, name")
        .eq("hotel_id", hotelId)
        .eq("area_id", areaId)
        .order("name", { ascending: true });

      if (error) throw error;
      setAudits((data ?? []) as any);
    } catch (e: any) {
      setAudits([]);
      setError(e?.message || "Error cargando auditorías.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 950 }}>{title}</div>
          <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800, opacity: 0.65 }}>
            {areaId ? "Auditorías (plantillas) existentes para esta área." : "Selecciona un área en la columna izquierda."}
          </div>
        </div>

        <button
          onClick={reload}
          disabled={!areaId || loading}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "white",
            fontWeight: 950,
            cursor: !areaId || loading ? "not-allowed" : "pointer",
            opacity: !areaId || loading ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "…" : "Recargar"}
        </button>
      </div>

      {error ? <ErrorBox text={error} /> : null}

      {!areaId ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.10)",
            background: "rgba(0,0,0,0.02)",
            fontWeight: 900,
            opacity: 0.75,
          }}
        >
          Selecciona un área para ver sus auditorías.
        </div>
      ) : loading ? (
        <div style={{ padding: 14, fontWeight: 900, opacity: 0.75 }}>Cargando…</div>
      ) : audits.length === 0 ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.10)",
            background: "rgba(0,0,0,0.02)",
            fontWeight: 900,
            opacity: 0.75,
          }}
        >
          No hay auditorías en esta área.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {audits.map((a) => (
            <div
              key={a.id}
              style={{
                padding: 14,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.10)",
                background: "white",
                fontWeight: 950,
              }}
            >
              {a.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div
      style={{
        marginBottom: 12,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(220,0,0,0.35)",
        background: "rgba(220,0,0,0.06)",
        color: "crimson",
        fontWeight: 900,
      }}
    >
      {text}
    </div>
  );
}