"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";

type PackRow = {
  id: string;
  business_type: string;
  name: string;
  description: string | null;
  active: boolean;
};

type TemplateRow = {
  id: string;
  name: string;
  scope: string | null;
  created_at: string | null;
  active?: boolean | null;
  area_id?: string | null;
};

type PackTemplateRow = {
  audit_template_id: string;
  position: number;
};

export default function PackDetailPage() {
  const router = useRouter();
  const params = useParams();

  const packId = useMemo(() => {
    const raw = (params as any)?.id;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) return raw[0] ?? null;
    return null;
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pack, setPack] = useState<PackRow | null>(null);

  const [globalTemplates, setGlobalTemplates] = useState<TemplateRow[]>([]);
  const [packTemplates, setPackTemplates] = useState<PackTemplateRow[]>([]);

  // edición pack
  const [bt, setBt] = useState("hotel");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [active, setActive] = useState(true);

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
      height: 42,
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
      height: 42,
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
      height: 42,
    };
    const label: React.CSSProperties = { fontSize: 12, opacity: 0.75, fontWeight: 900 };
    const row: React.CSSProperties = {
      background: "rgba(0,0,0,0.02)",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 14,
      padding: "10px 12px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    };
    return { page, card, btnDark, btnWhite, input, label, row };
  }, []);

  const templatesInPack = useMemo(() => {
    const map = new Map(packTemplates.map((x) => [x.audit_template_id, x.position]));
    return globalTemplates
      .filter((t) => map.has(t.id))
      .map((t) => ({ ...t, position: map.get(t.id) ?? 0 }))
      .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name));
  }, [globalTemplates, packTemplates]);

  const templatesNotInPack = useMemo(() => {
    const set = new Set(packTemplates.map((x) => x.audit_template_id));
    return globalTemplates.filter((t) => !set.has(t.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [globalTemplates, packTemplates]);

  async function load() {
    setLoading(true);
    setError(null);

    if (!packId) {
      setError("Falta el ID en la URL. Abre un pack desde la lista.");
      setLoading(false);
      return;
    }

    const p = await requireRoleOrRedirect(router, ["superadmin"], "/dashboard");
    if (!p) return;

    const { data: packData, error: pErr } = await supabase
      .from("global_audit_packs")
      .select("id, business_type, name, description, active")
      .eq("id", packId)
      .maybeSingle();

    if (pErr) {
      setError(pErr.message);
      setLoading(false);
      return;
    }
    if (!packData) {
      setError("Pack no encontrado.");
      setLoading(false);
      return;
    }

    setPack(packData as PackRow);
    setBt((packData as any).business_type ?? "hotel");
    setName((packData as any).name ?? "");
    setDesc((packData as any).description ?? "");
    setActive(Boolean((packData as any).active));

    // plantillas globales
    const { data: tData, error: tErr } = await supabase
      .from("audit_templates")
      .select("id, name, scope, created_at, active, area_id")
      .eq("scope", "global")
      .order("name", { ascending: true });

    if (tErr) {
      setError(tErr.message);
      setLoading(false);
      return;
    }
    setGlobalTemplates((tData ?? []) as TemplateRow[]);

    // mapping pack->plantillas
    const { data: mData, error: mErr } = await supabase
      .from("global_audit_pack_templates")
      .select("audit_template_id, position")
      .eq("pack_id", packId)
      .order("position", { ascending: true });

    if (mErr) {
      setError(mErr.message);
      setLoading(false);
      return;
    }
    setPackTemplates((mData ?? []) as PackTemplateRow[]);

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
  }, [packId]);

  async function savePack() {
    if (!pack || !packId) return;
    if (!name.trim()) {
      setError("El pack necesita nombre.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: e } = await supabase
      .from("global_audit_packs")
      .update({
        business_type: bt.trim(),
        name: name.trim(),
        description: desc.trim() ? desc.trim() : null,
        active,
      })
      .eq("id", pack.id);

    if (e) setError(e.message);
    await load();
    setSaving(false);
  }

  async function addTemplate(templateId: string) {
    if (!packId) return;

    setSaving(true);
    setError(null);

    const last = packTemplates.reduce((mx, x) => Math.max(mx, x.position ?? 0), 0);
    const nextPos = last + 10;

    const { error: e } = await supabase.from("global_audit_pack_templates").insert({
      pack_id: packId,
      audit_template_id: templateId,
      position: nextPos,
    });

    if (e) setError(e.message);
    await load();
    setSaving(false);
  }

  async function removeTemplate(templateId: string) {
    if (!packId) return;

    setSaving(true);
    setError(null);

    const { error: e } = await supabase
      .from("global_audit_pack_templates")
      .delete()
      .eq("pack_id", packId)
      .eq("audit_template_id", templateId);

    if (e) setError(e.message);
    await load();
    setSaving(false);
  }

  async function setPosition(templateId: string, position: number) {
    if (!packId) return;

    setSaving(true);
    setError(null);

    const { error: e } = await supabase
      .from("global_audit_pack_templates")
      .update({ position })
      .eq("pack_id", packId)
      .eq("audit_template_id", templateId);

    if (e) setError(e.message);
    await load();
    setSaving(false);
  }

  /**
   * ✅ PASO 1 (lo que me pides):
   * Crear plantilla GLOBAL y abrir directamente el editor:
   * /superadmin/templates/[templateId]
   *
   * Esto evita /superadmin/templates/new y evita el check constraint "scope_hotel_check".
   */
  async function createGlobalTemplateAndOpenEditor() {
    if (!packId) return;

    const tplNameRaw = window.prompt("Nombre de la plantilla global:", "Nueva plantilla global");
    const tplName = (tplNameRaw ?? "").trim();
    if (!tplName) return;

    setSaving(true);
    setError(null);

    try {
      // 1) Crear plantilla global (MUY IMPORTANTE: scope='global')
      const { data: newTpl, error: cErr } = await supabase
        .from("audit_templates")
        .insert({
          name: tplName,
          scope: "global",
          active: true,
          area_id: null,
          // Si tu tabla tiene hotel_id con NOT NULL para scope='hotel',
          // dejarlo FUERA o a null es lo correcto para scope='global'.
          // hotel_id: null,
        })
        .select("id")
        .single();

      if (cErr) throw cErr;
      if (!newTpl?.id) throw new Error("No se pudo crear la plantilla (sin id).");

      // 2) Añadirla al pack automáticamente (última posición)
      const last = packTemplates.reduce((mx, x) => Math.max(mx, x.position ?? 0), 0);
      const nextPos = last + 10;

      const { error: mErr } = await supabase.from("global_audit_pack_templates").insert({
        pack_id: packId,
        audit_template_id: newTpl.id,
        position: nextPos,
      });

      if (mErr) throw mErr;

      // 3) Abrir editor directamente (tu Builder + Import Excel)
      router.push(`/superadmin/templates/${newTpl.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Error creando plantilla global.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <HotelHeader />
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={styles.page}>
        <HotelHeader />
        <button style={styles.btnWhite} onClick={() => router.push("/superadmin/global-audits")}>
          ← Atrás
        </button>
        <div style={{ marginTop: 14, color: "var(--danger)", fontWeight: 900, whiteSpace: "pre-wrap" }}>{error}</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <HotelHeader />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: -0.4 }}>{pack?.name}</div>
          <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
            Pack global para <strong>{pack?.business_type}</strong>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>ID: {pack?.id}</div>
        </div>

        <button style={styles.btnWhite} onClick={() => router.push("/superadmin/global-audits")}>
          ← Atrás
        </button>
      </div>

      <div style={{ ...styles.card, marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 12 }}>Configuración</div>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, alignItems: "end" }}>
          <div>
            <div style={styles.label}>Tipo de negocio</div>
            <select value={bt} onChange={(e) => setBt(e.target.value)} style={styles.input}>
              <option value="hotel">hotel</option>
              <option value="restaurant">restaurant</option>
              <option value="spa">spa</option>
              <option value="other">other</option>
            </select>
          </div>

          <div>
            <div style={styles.label}>Nombre</div>
            <input value={name} onChange={(e) => setName(e.target.value)} style={styles.input} />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={styles.label}>Descripción</div>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} style={styles.input} />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900 }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Activo
            </label>

            <div style={{ flex: 1 }} />

            <button style={styles.btnDark} disabled={saving} onClick={savePack}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={styles.card}>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 10 }}>Plantillas en el Pack</div>

          {templatesInPack.length === 0 ? (
            <div style={{ opacity: 0.75 }}>Este pack no tiene plantillas aún.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {templatesInPack.map((t: any) => (
                <div key={t.id} style={styles.row}>
                  <div style={{ minWidth: 240 }}>
                    <div style={{ fontWeight: 950 }}>{t.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>ID: {t.id}</div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button style={styles.btnWhite} onClick={() => router.push(`/superadmin/templates/${t.id}`)}>
                      Editar
                    </button>
                    <button style={styles.btnWhite} onClick={() => router.push(`/superadmin/templates/${t.id}/import`)}>
                      Importar
                    </button>

                    <input
                      type="number"
                      value={Number(t.position ?? 0)}
                      onChange={(e) => setPosition(t.id, Number(e.target.value || 0))}
                      style={{ ...styles.input, width: 120 }}
                    />

                    <button style={styles.btnWhite} disabled={saving} onClick={() => removeTemplate(t.id)}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 10 }}>Plantillas globales disponibles</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            {/* ✅ ESTE ES EL BOTÓN CORRECTO: crea y abre editor */}
            <button style={styles.btnDark} disabled={saving} onClick={createGlobalTemplateAndOpenEditor}>
              + Crear plantilla global
            </button>
          </div>

          {templatesNotInPack.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No hay más plantillas globales para añadir.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {templatesNotInPack.map((t) => (
                <div key={t.id} style={styles.row}>
                  <div style={{ minWidth: 240 }}>
                    <div style={{ fontWeight: 950 }}>{t.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>ID: {t.id}</div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button style={styles.btnWhite} onClick={() => router.push(`/superadmin/templates/${t.id}`)}>
                      Editar
                    </button>
                    <button style={styles.btnWhite} onClick={() => router.push(`/superadmin/templates/${t.id}/import`)}>
                      Importar
                    </button>
                    <button style={styles.btnDark} disabled={saving} onClick={() => addTemplate(t.id)}>
                      Añadir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}