"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";

type AreaRow = {
  id: string;
  name: string;
  type: string | null;
};

export default function BuilderNewTemplatePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>(null);
  const [areas, setAreas] = useState<AreaRow[]>([]);

  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = await requireRoleOrRedirect(router, ["admin", "manager"], "/areas");
        if (!p) return;
        setProfile(p);

        const { data, error } = await supabase
          .from("areas")
          .select("id,name,type")
          .eq("hotel_id", p.hotel_id)
          .order("name", { ascending: true });

        if (error) throw error;

        const list = (data ?? []) as AreaRow[];
        setAreas(list);

        // default: primera área si existe
        if (list.length && !areaId) setAreaId(list[0].id);

        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        setError(e?.message ?? "Error cargando áreas.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const areaLabelById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of areas) m[a.id] = a.type ? `${a.name} · ${a.type}` : a.name;
    return m;
  }, [areas]);

  async function handleCreate() {
    if (!profile) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Escribe un nombre para la auditoría.");
      return;
    }
    if (!areaId) {
      setError("Selecciona un área.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // NOTA: esto asume que audit_templates tiene hotel_id.
      // Si no lo tiene, dímelo y lo ajusto.
      const { data, error } = await supabase
        .from("audit_templates")
        .insert({
          hotel_id: profile.hotel_id,
          area_id: areaId,
          name: trimmed,
          active: true,
        })
        .select("id")
        .single();

      if (error || !data) throw error ?? new Error("No se pudo crear la auditoría.");

      router.push(`/builder/${data.id}`);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo crear la auditoría.");
    } finally {
      setSaving(false);
    }
  }

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    padding: 18,
  };

  const btnPrimary: React.CSSProperties = {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 950,
    cursor: saving ? "not-allowed" : "pointer",
    opacity: saving ? 0.7 : 1,
    height: 44,
  };

  const btnGhost: React.CSSProperties = {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
  };

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 48, marginBottom: 8 }}>Nueva auditoría</h1>
        <p>Cargando…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 48, marginBottom: 8 }}>Nueva auditoría</h1>
        <p style={{ color: "crimson", fontWeight: 900 }}>{error}</p>

        <div style={{ marginTop: 16 }}>
          <Link href="/builder" style={btnGhost}>
            Volver al constructor
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24}}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 48, marginBottom: 6 }}>Nueva auditoría</h1>
          <div style={{ opacity: 0.85 }}>
            Rol: <strong>{profile?.role}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/builder" style={btnGhost}>
            Volver
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 16, ...card }}>
        <div style={{ fontWeight: 950, fontSize: 18, marginBottom: 12 }}>Datos básicos</div>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Nombre de la auditoría</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Ej: "Guest Room Standards"'
              style={{
                width: "100%",
                padding: "12px 12px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.18)",
                fontWeight: 800,
                outline: "none",
              }}
            />
            <div style={{ marginTop: 6, fontSize: 12.5, opacity: 0.75 }}>
              Consejo: usa un nombre corto y específico (luego puedes duplicar y versionar).
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Área</div>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 12px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.18)",
                fontWeight: 900,
                outline: "none",
                background: "#fff",
              }}
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {areaLabelById[a.id] ?? a.name}
                </option>
              ))}
            </select>

            {areas.length === 0 ? (
              <div style={{ marginTop: 10, color: "crimson", fontWeight: 900 }}>
                No tienes áreas creadas. Crea un área antes de crear auditorías.
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={handleCreate} disabled={saving || areas.length === 0} style={btnPrimary}>
              {saving ? "Creando…" : "Crear auditoría"}
            </button>

            <Link href="/builder" style={btnGhost}>
              Cancelar
            </Link>
          </div>

          <div style={{ fontSize: 13, opacity: 0.7 }}>
            Al crearla, irás al editor para añadir secciones y preguntas.
          </div>
        </div>
      </div>
    </main>
  );
}
