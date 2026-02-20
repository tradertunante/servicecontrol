// app/standards/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import HotelHeader from "@/app/components/HotelHeader";

type Library = {
  id: string;
  name: string;
  scope: string;
  category: string | null;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

type Section = {
  id: string;
  name: string;
  template_id: string;
};

type Question = {
  id: string;
  section_id: string;
  text: string;
};

export default function LibraryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const libraryId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [library, setLibrary] = useState<Library | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null);
  const openTemplate = useMemo(
    () => templates.find((t) => t.id === openTemplateId) ?? null,
    [templates, openTemplateId]
  );

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: lib, error: lErr } = await supabase
          .from("standard_libraries")
          .select("id, name, scope, category")
          .eq("id", libraryId)
          .maybeSingle();

        if (lErr) throw lErr;
        if (!lib) throw new Error("Biblioteca no encontrada.");

        if (!alive) return;
        setLibrary(lib as Library);

        const { data: t, error: tErr } = await supabase
          .from("standard_templates")
          .select("id, name, description, active")
          .eq("library_id", libraryId)
          .eq("active", true)
          .order("name", { ascending: true });

        if (tErr) throw tErr;

        if (!alive) return;
        setTemplates((t ?? []) as Template[]);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Error cargando la biblioteca.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [libraryId]);

  // Modal: cargar secciones + preguntas
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!openTemplateId) return;

      setModalLoading(true);
      setModalError(null);
      setSections([]);
      setQuestions([]);

      try {
        // ✅ Tu tabla real es standard_sections
        // ✅ y NO tiene description/position (por lo que NO las pedimos)
        const { data: s, error: sErr } = await supabase
          .from("standard_sections")
          .select("id, name, template_id")
          .eq("template_id", openTemplateId)
          .order("name", { ascending: true });

        if (sErr) throw sErr;

        const secArr = (s ?? []) as Section[];
        if (!alive) return;
        setSections(secArr);

        if (secArr.length === 0) {
          setModalLoading(false);
          return;
        }

        const sectionIds = secArr.map((x) => x.id);

        const { data: q, error: qErr } = await supabase
          .from("standard_questions")
          .select("id, section_id, text")
          .in("section_id", sectionIds)
          .order("id", { ascending: true });

        if (qErr) throw qErr;

        if (!alive) return;
        setQuestions((q ?? []) as Question[]);
        setModalLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setModalError(e?.message ?? "Error cargando la plantilla.");
        setModalLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [openTemplateId]);

  const pageWrap: React.CSSProperties = { padding: 24, paddingTop: 96 };

  const btnDark: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
  };

  const btnWhite: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
  };

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  };

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    zIndex: 50,
  };

  const modal: React.CSSProperties = {
    width: "min(980px, 100%)",
    borderRadius: 18,
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.12)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    padding: 18,
  };

  if (loading) {
    return (
      <main style={pageWrap}>
        <HotelHeader />
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={pageWrap}>
        <HotelHeader />
        <div style={{ color: "crimson", fontWeight: 900 }}>{error}</div>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <HotelHeader />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: -0.6 }}>
            {library?.name ?? "Biblioteca"}
          </div>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            🌍 {library?.scope ?? "—"} · {library?.category ?? "—"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={btnWhite} onClick={() => router.push("/standards")}>
            ← Atrás
          </button>
        </div>
      </div>

      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 10 }}>📄 Plantillas</div>

        {templates.length === 0 ? (
          <div style={{ opacity: 0.75 }}>Esta biblioteca no tiene plantillas aún.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {templates.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "rgba(0,0,0,0.02)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 950, fontSize: 15 }}>{t.name}</div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>{t.description ?? "—"}</div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button style={btnDark} onClick={() => setOpenTemplateId(t.id)}>
                    Ver
                  </button>
                  <button
                    style={btnWhite}
                    onClick={() => {
                      alert("Aquí luego irá 'Importar plantilla'");
                    }}
                  >
                    Importar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {openTemplateId && (
        <div style={overlay} onClick={() => setOpenTemplateId(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 950, fontSize: 18 }}>{openTemplate?.name ?? "Plantilla"}</div>
                <div style={{ opacity: 0.7, marginTop: 4, fontSize: 13 }}>{openTemplate?.description ?? "—"}</div>
              </div>
              <button style={btnWhite} onClick={() => setOpenTemplateId(null)}>
                Cerrar
              </button>
            </div>

            <div style={{ marginTop: 14 }}>
              {modalLoading ? (
                <div style={{ opacity: 0.8 }}>Cargando contenido…</div>
              ) : modalError ? (
                <div style={{ color: "crimson", fontWeight: 900 }}>{modalError}</div>
              ) : sections.length === 0 ? (
                <div style={{ opacity: 0.75 }}>Esta plantilla todavía no tiene secciones.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {sections.map((s) => {
                    const qs = questions.filter((q) => q.section_id === s.id);
                    return (
                      <div
                        key={s.id}
                        style={{
                          borderRadius: 14,
                          border: "1px solid rgba(0,0,0,0.08)",
                          background: "rgba(0,0,0,0.02)",
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "baseline",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ fontWeight: 950 }}>{s.name}</div>
                          <div style={{ opacity: 0.7, fontSize: 12 }}>{qs.length} preguntas</div>
                        </div>

                        {qs.length > 0 && (
                          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                            {qs.slice(0, 10).map((q) => (
                              <div
                                key={q.id}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 12,
                                  background: "#fff",
                                  border: "1px solid rgba(0,0,0,0.06)",
                                  fontSize: 13,
                                }}
                              >
                                {q.text}
                              </div>
                            ))}
                            {qs.length > 10 && (
                              <div style={{ opacity: 0.7, fontSize: 12 }}>…y {qs.length - 10} más</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}