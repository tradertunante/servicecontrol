"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import { canRunAudits } from "@/lib/auth/permissions";

type AuditRun = {
  id: string;
  area_id: string;
  audit_template_id: string;
  status: string | null;
  score: number | null;
  executed_at: string | null;
  created_at?: string | null;
};

type Area = { id: string; name: string; type: string | null };
type Template = { id: string; name: string };

type AnswerRow = {
  question_id: string;
  result: string | null; // en tu DB parece ser "FAIL" o "NA"
  answer: string | null; // NOT NULL en tu DB (pero por seguridad lo tratamos como nullable)
  comment: string | null;
};

type QuestionRow = {
  id: string;
  text: string;
  audit_section_id: string | null;
  weight: number | null;
};

type SectionRow = {
  id: string;
  name: string;
};

type Item = {
  question_id: string;
  question_text: string;
  section_id: string;
  section_name: string;
  status: "FAIL" | "NA" | "OK";
  comment: string | null;
};

function normalizeStatus(a: AnswerRow | undefined): "FAIL" | "NA" | "OK" {
  const raw = (a?.result ?? a?.answer ?? "").toString().trim().toUpperCase();
  if (raw === "FAIL") return "FAIL";
  if (raw === "NA" || raw === "N/A") return "NA";
  return "OK";
}

export default function AuditRunSectionDetailPage() {
  const router = useRouter();
  const params = useParams<{ areaId: string; runId: string }>();
  const areaId = params?.areaId;
  const runId = params?.runId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>(null);

  const [run, setRun] = useState<AuditRun | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);

  const [items, setItems] = useState<Item[]>([]);

  const [filter, setFilter] = useState<"ALL" | "FAIL" | "NA" | "OK">("ALL");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!areaId || !runId) return;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = await requireRoleOrRedirect(router, ["admin", "manager", "auditor"], "/areas");
        if (!p) return;
        setProfile(p);

        if (!canRunAudits(p.role)) {
          setError("No tienes permisos para ver este detalle.");
          setLoading(false);
          return;
        }

        // 1) audit_run
        const { data: runData, error: runErr } = await supabase
          .from("audit_runs")
          .select("id,area_id,audit_template_id,status,score,executed_at,created_at")
          .eq("id", runId)
          .single();

        if (runErr || !runData) throw runErr ?? new Error("No se encontró la auditoría.");

        // Seguridad: asegura que pertenece al área
        if (runData.area_id !== areaId) {
          throw new Error("Esta auditoría no pertenece a esta área.");
        }

        setRun(runData as AuditRun);

        // 2) area + template
        const [{ data: areaData, error: areaErr }, { data: tplData, error: tplErr }] =
          await Promise.all([
            supabase.from("areas").select("id,name,type").eq("id", areaId).single(),
            supabase
              .from("audit_templates")
              .select("id,name")
              .eq("id", runData.audit_template_id)
              .single(),
          ]);

        if (areaErr) throw areaErr;
        if (tplErr) throw tplErr;

        setArea(areaData as Area);
        setTemplate(tplData as Template);

        // 3) answers (SIN EMBEDS para evitar el error de relaciones múltiples)
        const { data: ansData, error: ansErr } = await supabase
          .from("audit_answers")
          .select("question_id,result,answer,comment")
          .eq("audit_run_id", runId);

        if (ansErr) throw ansErr;

        const answers = (ansData ?? []) as AnswerRow[];
        const qids = answers.map((a) => a.question_id).filter(Boolean);

        if (qids.length === 0) {
          setItems([]);
          setLoading(false);
          return;
        }

        // 4) questions
        const { data: qData, error: qErr } = await supabase
          .from("audit_questions")
          .select("id,text,audit_section_id,weight")
          .in("id", qids);

        if (qErr) throw qErr;

        const questions = (qData ?? []) as QuestionRow[];

        // 5) sections
        const sectionIds = Array.from(
          new Set(
            questions
              .map((q) => q.audit_section_id)
              .filter((x): x is string => typeof x === "string" && x.length > 0)
          )
        );

        let sections: SectionRow[] = [];
        if (sectionIds.length > 0) {
          const { data: sData, error: sErr } = await supabase
            .from("audit_sections")
            .select("id,name")
            .in("id", sectionIds);

          if (sErr) throw sErr;
          sections = (sData ?? []) as SectionRow[];
        }

        const sectionNameById = new Map<string, string>();
        for (const s of sections) sectionNameById.set(s.id, s.name);

        const ansByQid = new Map<string, AnswerRow>();
        for (const a of answers) ansByQid.set(a.question_id, a);

        // 6) build items
        const built: Item[] = questions.map((q) => {
          const a = ansByQid.get(q.id);
          const section_id = q.audit_section_id ?? "no_section";
          const section_name = sectionNameById.get(section_id) ?? "Sin sección";

          return {
            question_id: q.id,
            question_text: q.text,
            section_id,
            section_name,
            status: normalizeStatus(a),
            comment: (a?.comment ?? "").trim() || null,
          };
        });

        // Orden: sección (A-Z) y luego texto
        built.sort((x, y) => {
          const sx = (x.section_name ?? "").toLowerCase();
          const sy = (y.section_name ?? "").toLowerCase();
          if (sx !== sy) return sx.localeCompare(sy);
          return x.question_text.localeCompare(y.question_text);
        });

        setItems(built);

        // Por defecto: abrir todas las secciones
        const opens: Record<string, boolean> = {};
        for (const it of built) opens[it.section_id] = true;
        setOpenSections(opens);

        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        setError(e?.message ?? "Error cargando detalle por sección.");
      }
    })();
  }, [areaId, runId, router]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { section_id: string; section_name: string; items: Item[]; fail: number; na: number; ok: number }
    >();

    const filtered = items.filter((it) => (filter === "ALL" ? true : it.status === filter));

    for (const it of filtered) {
      const key = it.section_id;
      if (!map.has(key)) {
        map.set(key, {
          section_id: it.section_id,
          section_name: it.section_name,
          items: [],
          fail: 0,
          na: 0,
          ok: 0,
        });
      }
      const bucket = map.get(key)!;
      bucket.items.push(it);
      if (it.status === "FAIL") bucket.fail += 1;
      else if (it.status === "NA") bucket.na += 1;
      else bucket.ok += 1;
    }

    // orden por nombre de sección
    return Array.from(map.values()).sort((a, b) =>
      a.section_name.toLowerCase().localeCompare(b.section_name.toLowerCase())
    );
  }, [items, filter]);

  const totals = useMemo(() => {
    let fail = 0,
      na = 0,
      ok = 0;
    for (const it of items) {
      if (it.status === "FAIL") fail += 1;
      else if (it.status === "NA") na += 1;
      else ok += 1;
    }
    return { fail, na, ok, total: items.length };
  }, [items]);

  function badgeStyle(status: "FAIL" | "NA" | "OK"): React.CSSProperties {
    if (status === "FAIL") return { background: "crimson", color: "#fff" };
    if (status === "NA") return { background: "#444", color: "#fff" };
    return { background: "#0a0", color: "#fff" };
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 44, marginBottom: 8 }}>Detalle por sección</h1>
        <p>Cargando…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 44, marginBottom: 8 }}>Detalle por sección</h1>
        <p style={{ color: "crimson", fontWeight: 800 }}>{error}</p>

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push(`/areas/${areaId}`)}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.2)",
              background: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Volver al área
          </button>

          <button
            onClick={() => router.push(`/areas/${areaId}/history`)}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.2)",
              background: "#000",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Volver al historial
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 52, marginBottom: 6 }}>Detalle por sección</h1>
          <div style={{ opacity: 0.85, lineHeight: 1.6 }}>
            <div>
              <strong>Área:</strong> {area?.name ?? areaId} {area?.type ? `(${area.type})` : ""}
            </div>
            <div>
              <strong>Auditoría:</strong> {template?.name ?? run?.audit_template_id}
            </div>
            <div>
              <strong>Run ID:</strong> {run?.id}
            </div>
            <div>
              <strong>Estado:</strong> {run?.status ?? "-"}{" "}
              {run?.executed_at ? `· Ejecutada: ${new Date(run.executed_at).toLocaleString()}` : ""}
            </div>
            <div>
              <strong>Score:</strong> {typeof run?.score === "number" ? `${run.score}%` : "-"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <button
            onClick={() => router.push(`/areas/${areaId}/history`)}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.2)",
              background: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Volver al historial
          </button>

          <button
            onClick={() => router.push(`/areas/${areaId}`)}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.2)",
              background: "#000",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Volver al área
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div
        style={{
          marginTop: 18,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 900 }}>Filtro:</div>

        {(["ALL", "FAIL", "NA", "OK"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.2)",
              background: filter === f ? "#000" : "#fff",
              color: filter === f ? "#fff" : "#000",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {f === "ALL" ? "Todos" : f}
          </button>
        ))}

        <div style={{ marginLeft: 8, opacity: 0.85 }}>
          Totales: <strong>{totals.total}</strong> · FAIL: <strong>{totals.fail}</strong> · NA:{" "}
          <strong>{totals.na}</strong> · OK: <strong>{totals.ok}</strong>
        </div>
      </div>

      {/* Secciones */}
      <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
        {grouped.map((sec) => {
          const isOpen = openSections[sec.section_id] ?? true;

          return (
            <div
              key={sec.section_id}
              style={{
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 18,
                background: "rgba(255,255,255,0.75)",
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() =>
                      setOpenSections((prev) => ({
                        ...prev,
                        [sec.section_id]: !isOpen,
                      }))
                    }
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.2)",
                      background: "#fff",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {isOpen ? "Ocultar" : "Ver"}
                  </button>

                  <div style={{ fontSize: 22, fontWeight: 900 }}>{sec.section_name}</div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: "#fff",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    Total: {sec.items.length}
                  </span>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: "#fff",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    FAIL: {sec.fail}
                  </span>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: "#fff",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    NA: {sec.na}
                  </span>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: "#fff",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    OK: {sec.ok}
                  </span>
                </div>
              </div>

              {isOpen ? (
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {sec.items.map((it, idx) => (
                    <div
                      key={it.question_id}
                      style={{
                        border: "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 14,
                        padding: 12,
                        background: "#fff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 900 }}>
                          {idx + 1}. {it.question_text}
                        </div>
                        <span
                          style={{
                            ...badgeStyle(it.status),
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontWeight: 900,
                            fontSize: 12,
                            height: "fit-content",
                          }}
                        >
                          {it.status}
                        </span>
                      </div>

                      {it.comment ? (
                        <div style={{ marginTop: 8, opacity: 0.9 }}>
                          <strong>Comentario:</strong> {it.comment}
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, opacity: 0.55, fontSize: 13 }}>
                          Sin comentario.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        {items.length === 0 ? (
          <div style={{ opacity: 0.8, marginTop: 10 }}>
            Esta auditoría no tiene respuestas (audit_answers) todavía.
          </div>
        ) : null}
      </div>
    </main>
  );
}
