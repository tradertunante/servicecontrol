"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";

type TemplateRow = {
  id: string;
  name: string;
  scope: string | null;
  created_at: string | null;
  active?: boolean | null;
};

const GLOBAL_HOTEL_ID = "5b71b6d2-d34e-4b68-95b8-f7c2ab9bcbc8"; // Hotel Demo (contenedor global)

export default function GlobalTemplatesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [name, setName] = useState("");

  const styles = useMemo(() => {
    const page: React.CSSProperties = { padding: 24, paddingTop: 80 };
    const card: React.CSSProperties = {
      background: "var(--card-bg)",
      border: "1px solid var(--header-border)",
      borderRadius: 18,
      boxShadow: "var(--shadow-sm)",
      padding: 18,
    };
    const btnDark: React.CSSProperties = {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,0.18)",
      background: "#000",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
      fontSize: 14,
      whiteSpace: "nowrap",
    };
    const btnWhite: React.CSSProperties = {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid var(--input-border)",
      background: "var(--input-bg)",
      color: "var(--input-text)",
      fontWeight: 900,
      cursor: "pointer",
      fontSize: 14,
      whiteSpace: "nowrap",
    };
    const input: React.CSSProperties = {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      outline: "none",
      fontSize: 14,
      border: "1px solid var(--input-border)",
      background: "var(--input-bg)",
      color: "var(--input-text)",
    };
    const row: React.CSSProperties = {
      background: "rgba(0,0,0,0.02)",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 14,
      padding: "12px 14px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    };
    return { page, card, btnDark, btnWhite, input, row };
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    const p = await requireRoleOrRedirect(router, ["superadmin"], "/dashboard");
    if (!p) return;

    const { data, error: e } = await supabase
      .from("audit_templates")
      .select("id, name, scope, created_at, active")
      .eq("scope", "global")
      .order("created_at", { ascending: false });

    if (e) setError(e.message);
    setTemplates((data ?? []) as TemplateRow[]);
    setLoading(false);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createTemplate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Pon un nombre para la plantilla.");
      return;
    }

    setSaving(true);
    setError(null);

    // ✅ IMPORTANTÍSIMO: hotel_id NO puede ser null (en tu DB es NOT NULL)
    const { data, error: e } = await supabase
      .from("audit_templates")
      .insert({
        name: trimmed,
        scope: "global",
        active: true,
        hotel_id: GLOBAL_HOTEL_ID,
        area_id: null,
      })
      .select("id")
      .single();

    if (e) {
      setError(e.message);
      setSaving(false);
      return;
    }

    const newId = (data as any)?.id as string;
    setName("");
    setSaving(false);

    router.push(`/superadmin/templates/${newId}`);
  }

  return (
    <main style={styles.page}>
      <HotelHeader />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: -0.4 }}>Plantillas Globales</div>
          <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
            Crea y edita plantillas base para todos los hoteles.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={styles.btnWhite} onClick={() => router.push("/superadmin")}>
            ← Atrás
          </button>
          <button style={styles.btnWhite} onClick={load}>
            Recargar
          </button>
        </div>
      </div>

      <div style={{ ...styles.card, marginTop: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 10 }}>Crear plantilla global</div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            style={styles.input}
            placeholder="Ej: Forbes HK - Habitaciones"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button style={styles.btnDark} disabled={saving} onClick={createTemplate}>
            {saving ? "Creando…" : "Crear"}
          </button>
        </div>

        <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12, fontWeight: 900 }}>
          Contenedor global (hotel_id): {GLOBAL_HOTEL_ID}
        </div>

        {error ? <div style={{ marginTop: 12, color: "var(--danger)", fontWeight: 900 }}>{error}</div> : null}
      </div>

      <div style={{ ...styles.card, marginTop: 16 }}>
        {loading ? (
          <div style={{ opacity: 0.8 }}>Cargando…</div>
        ) : templates.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No hay plantillas globales aún.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {templates.map((t) => (
              <div key={t.id} style={styles.row}>
                <div style={{ minWidth: 260 }}>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>{t.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>ID: {t.id}</div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button style={styles.btnDark} onClick={() => router.push(`/superadmin/templates/${t.id}`)}>
                    Editar / Builder
                  </button>
                  <button style={styles.btnWhite} onClick={() => router.push(`/superadmin/templates/${t.id}/import`)}>
                    Importar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}