// FILE: app/superadmin/global-audits/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import HotelHeader from "@/app/components/HotelHeader";
import { fetchJsonOrThrow } from "@/lib/superadmin/clientApi";

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
  category: string | null;
  language: string;
};

type PackTemplateRow = {
  audit_template_id: string;
  position: number;
};

type CertificationRow = {
  id: string;
  name: string;
  active: boolean;
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
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pack, setPack] = useState<PackRow | null>(null);

  const [globalTemplates, setGlobalTemplates] = useState<TemplateRow[]>([]);
  const [packTemplates, setPackTemplates] = useState<PackTemplateRow[]>([]);
  const [search, setSearch] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const [allCertifications, setAllCertifications] = useState<CertificationRow[]>([]);
  const [packCertificationIds, setPackCertificationIds] = useState<string[]>([]);

  // edición pack
  const [bt, setBt] = useState("hotel");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [active, setActive] = useState(true);

  const styles = useMemo(() => {
    const page: CSSProperties = { padding: 24, paddingTop: 80 };
    const card: CSSProperties = {
      background: "var(--card-bg)",
      border: "1px solid var(--header-border)",
      borderRadius: 18,
      boxShadow: "var(--shadow-sm)",
      padding: 18,
    };
    const btnDark: CSSProperties = {
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
    const btnWhite: CSSProperties = {
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
    const input: CSSProperties = {
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
    const label: CSSProperties = { fontSize: 12, opacity: 0.75, fontWeight: 900 };
    const row: CSSProperties = {
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
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [globalTemplates, packTemplates]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const t of globalTemplates) {
      if (t.category) set.add(t.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [globalTemplates]);

  const templatesNotInPack = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Sin búsqueda ni categoría elegida no se muestra nada: el catálogo
    // global crece rápido y volcarlo entero es imposible de trabajar.
    if (!q && !filterCategory) return [];

    const set = new Set(packTemplates.map((x) => x.audit_template_id));
    return globalTemplates
      .filter((t) =>
        !set.has(t.id) &&
        (!q || t.name.toLowerCase().includes(q)) &&
        (!filterLanguage || t.language === filterLanguage) &&
        (!filterCategory || t.category === filterCategory)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [globalTemplates, packTemplates, search, filterLanguage, filterCategory]);

  const certificationsInPack = useMemo(() => {
    const set = new Set(packCertificationIds);
    return allCertifications
      .filter((c) => set.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [allCertifications, packCertificationIds]);

  const certificationsNotInPack = useMemo(() => {
    const set = new Set(packCertificationIds);
    return allCertifications
      .filter((c) => !set.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [allCertifications, packCertificationIds]);

  async function load() {
    setLoading(true);
    setError(null);

    if (!packId) {
      setError("Falta el ID en la URL. Abre un pack desde la lista.");
      setLoading(false);
      return;
    }

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
      .select("id, name, scope, created_at, active, area_id, category, language")
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

    // catálogo de certificados + certificados ya asignados a este pack
    const { data: certData, error: certErr } = await supabase
      .from("certification_standards")
      .select("id,name,active")
      .order("name", { ascending: true });

    if (certErr) {
      setError(certErr.message);
      setLoading(false);
      return;
    }
    setAllCertifications((certData ?? []) as CertificationRow[]);

    const { data: pcData, error: pcErr } = await supabase
      .from("global_audit_pack_certifications")
      .select("certification_standard_id")
      .eq("pack_id", packId);

    if (pcErr) {
      setError(pcErr.message);
      setLoading(false);
      return;
    }
    setPackCertificationIds((pcData ?? []).map((r) => r.certification_standard_id));

    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  async function deletePack() {
    if (!pack || !packId) return;
    if (!window.confirm(`¿Borrar el pack "${pack.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await fetchJsonOrThrow(`/api/superadmin/packs/${packId}`, { method: "DELETE" });
      router.push("/superadmin/global-audits");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo borrar el pack.");
      setDeleting(false);
    }
  }

  async function savePack() {
    if (!pack || !packId) return;
    if (!name.trim()) {
      setError("El pack necesita nombre.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await fetchJsonOrThrow(`/api/superadmin/packs/${pack.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          business_type: bt.trim(),
          name: name.trim(),
          description: desc.trim() ? desc.trim() : null,
          active,
        }),
      });
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar el pack.");
    }
    await load();
    setSaving(false);
  }

  async function addTemplate(templateId: string) {
    if (!packId) return;

    setSaving(true);
    setError(null);

    try {
      await fetchJsonOrThrow(`/api/superadmin/packs/${packId}/templates`, {
        method: "POST",
        body: JSON.stringify({
          template_id: templateId,
        }),
      });
    } catch (e: any) {
      setError(e?.message ?? "No se pudo agregar la plantilla.");
    }
    await load();
    setSaving(false);
  }

  async function removeTemplate(templateId: string) {
    if (!packId) return;

    setSaving(true);
    setError(null);

    try {
      await fetchJsonOrThrow(`/api/superadmin/packs/${packId}/templates/${templateId}`, {
        method: "DELETE",
      });
    } catch (e: any) {
      setError(e?.message ?? "No se pudo quitar la plantilla.");
    }
    await load();
    setSaving(false);
  }

  async function setPosition(templateId: string, position: number) {
    if (!packId) return;

    setSaving(true);
    setError(null);

    try {
      await fetchJsonOrThrow(`/api/superadmin/packs/${packId}/templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify({ position }),
      });
    } catch (e: any) {
      setError(e?.message ?? "No se pudo actualizar la posicion.");
    }
    await load();
    setSaving(false);
  }

  async function addCertification(certificationStandardId: string) {
    if (!packId) return;

    setSaving(true);
    setError(null);

    try {
      await fetchJsonOrThrow(`/api/superadmin/packs/${packId}/certifications`, {
        method: "POST",
        body: JSON.stringify({ certification_standard_id: certificationStandardId }),
      });
    } catch (e: any) {
      setError(e?.message ?? "No se pudo añadir el certificado.");
    }
    await load();
    setSaving(false);
  }

  async function removeCertification(certificationStandardId: string) {
    if (!packId) return;

    setSaving(true);
    setError(null);

    try {
      await fetchJsonOrThrow(`/api/superadmin/packs/${packId}/certifications/${certificationStandardId}`, {
        method: "DELETE",
      });
    } catch (e: any) {
      setError(e?.message ?? "No se pudo quitar el certificado.");
    }
    await load();
    setSaving(false);
  }

  async function createGlobalTemplateAndOpenEditor() {
    if (!packId) return;

    const tplNameRaw = window.prompt("Nombre de la plantilla global:", "Nueva plantilla global");
    const tplName = (tplNameRaw ?? "").trim();
    if (!tplName) return;

    setSaving(true);
    setError(null);

    try {
      const result = await fetchJsonOrThrow<{ template_id: string }>(`/api/superadmin/packs/${packId}/templates`, {
        method: "POST",
        body: JSON.stringify({ template_name: tplName }),
      });

      router.push(`/superadmin/templates/${result.template_id}`);
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

        <div style={{ display: "flex", gap: 10 }}>
          <button style={styles.btnWhite} onClick={() => router.push("/superadmin/global-audits")}>
            ← Atrás
          </button>
          <button
            style={{ ...styles.btnWhite, color: "#b91c1c", borderColor: "#fca5a5" }}
            disabled={deleting}
            onClick={deletePack}
          >
            {deleting ? "Borrando…" : "Borrar pack"}
          </button>
        </div>
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
              <option value="public_areas">public_areas</option>
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
                    <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                      {t.category && (
                        <span style={{ fontSize: 11, fontWeight: 900, padding: "2px 8px", borderRadius: 999, background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.1)" }}>
                          {t.category}
                        </span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 900, padding: "2px 8px", borderRadius: 999, background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", opacity: 0.7 }}>
                        {t.language ?? "es"}
                      </span>
                    </div>
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
            <button style={styles.btnDark} disabled={saving} onClick={createGlobalTemplateAndOpenEditor}>
              + Crear plantilla global
            </button>
            <input
              style={{ ...styles.input, flex: 1, minWidth: 160 }}
              placeholder="Buscar por nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value)}
              style={{ ...styles.input, width: 140 }}
            >
              <option value="">Todos los idiomas</option>
              <option value="es">🇪🇸 Español</option>
              <option value="en">🇬🇧 English</option>
              <option value="fr">🇫🇷 Français</option>
              <option value="de">🇩🇪 Deutsch</option>
              <option value="it">🇮🇹 Italiano</option>
              <option value="pt">🇵🇹 Português</option>
              <option value="zh">🇨🇳 中文</option>
              <option value="ar">🇸🇦 العربية</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ ...styles.input, width: 180 }}
            >
              <option value="">Elige una categoría…</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {!search.trim() && !filterCategory ? (
            <div style={{ opacity: 0.75 }}>
              Busca por nombre o elige una categoría para ver plantillas — el catálogo
              global es demasiado grande para mostrarlo entero.
            </div>
          ) : templatesNotInPack.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No hay más plantillas globales para añadir con ese filtro.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {templatesNotInPack.map((t) => (
                <div key={t.id} style={styles.row}>
                  <div style={{ minWidth: 240 }}>
                    <div style={{ fontWeight: 950 }}>{t.name}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                      {t.category && (
                        <span style={{ fontSize: 11, fontWeight: 900, padding: "2px 8px", borderRadius: 999, background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.1)" }}>
                          {t.category}
                        </span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 900, padding: "2px 8px", borderRadius: 999, background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", opacity: 0.7 }}>
                        {t.language ?? "es"}
                      </span>
                    </div>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={styles.card}>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 4 }}>Certificados del Pack</div>
          <div style={{ opacity: 0.75, fontSize: 13, marginBottom: 10 }}>
            Solo estos certificados estarán disponibles para etiquetar preguntas en las
            plantillas de este pack.
          </div>

          {certificationsInPack.length === 0 ? (
            <div style={{ opacity: 0.75 }}>Este pack no tiene certificados asignados aún.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {certificationsInPack.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px 6px 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "rgba(0,0,0,0.03)",
                    fontWeight: 900,
                  }}
                >
                  {c.name}
                  <button
                    onClick={() => removeCertification(c.id)}
                    disabled={saving}
                    title="Quitar del pack"
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: saving ? "not-allowed" : "pointer",
                      fontWeight: 900,
                      opacity: 0.7,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 10 }}>Certificados disponibles</div>

          {certificationsNotInPack.length === 0 ? (
            <div style={{ opacity: 0.75 }}>
              {allCertifications.length === 0
                ? "Todavía no hay certificados en el catálogo global (/superadmin/certifications)."
                : "Ya están todos los certificados del catálogo en este pack."}
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {certificationsNotInPack.map((c) => (
                <button
                  key={c.id}
                  onClick={() => addCertification(c.id)}
                  disabled={saving}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(0,0,0,0.2)",
                    background: "#fff",
                    fontWeight: 900,
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  + {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
