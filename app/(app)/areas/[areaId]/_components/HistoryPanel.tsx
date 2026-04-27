// FILE: app/(app)/areas/[areaId]/_components/HistoryPanel.tsx
"use client";

import Card from "@/components/ui/Card";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";

import type { AuditRunRow, AuditTemplate, PeriodKey, Role } from "../_lib/areaTypes";
import {
  canDeleteAudits,
  fmtDate,
  getPeriodRange,
  monthLabel,
  monthStartEndISO,
  safePeriod,
  scoreColor,
} from "../_lib/areaUtils";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card-bg)",
  color: "inherit",
  fontWeight: 900,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "#000",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 14px",
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card-bg)",
  color: "inherit",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const dangerBtn: React.CSSProperties = {
  padding: "10px 14px",
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card-bg)",
  color: "#b00020",
  fontWeight: 950,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function chipStyle(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.06)",
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 950,
    opacity: 0.9,
    whiteSpace: "nowrap",
  };
}

export default function HistoryPanel({
  areaId,
  profileRole,
  templates,
  onViewRun,
  onDeleteSuccess,
  embeddedTemplateFilter,
  embeddedPeriod,
  embeddedFailQuestionId,
  embeddedFailClassification,
  hotelId,
}: {
  areaId: string;
  profileRole: Role | null;
  templates: AuditTemplate[];
  onViewRun: (runId: string) => void;
  onDeleteSuccess: (deletedRunId: string) => void;
  embeddedTemplateFilter?: string | null;
  embeddedPeriod?: PeriodKey | null;
  embeddedFailQuestionId?: string | null;
  embeddedFailClassification?: string | null;
  hotelId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("app.area.history");
  const now = new Date();

  // ✅ filtros "manuales" (mes/año) para el modo clásico
  const [histTemplateId, setHistTemplateId] = useState<string>("");
  const [histYear, setHistYear] = useState<number>(now.getFullYear());
  const [histMonth, setHistMonth] = useState<number>(now.getMonth());

  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);
  const [histRuns, setHistRuns] = useState<AuditRunRow[]>([]);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const activeHotelId = hotelId;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const showDelete = canDeleteAudits(profileRole);

  // ✅ params desde dashboard
  const urlTemplate = embeddedTemplateFilter ?? searchParams.get("template") ?? "ALL";
  const urlPeriod = embeddedPeriod ?? safePeriod(searchParams.get("period"));
  const urlFailQ = (embeddedFailQuestionId ?? searchParams.get("fail_q") ?? "").trim();
  const urlFailCls = (embeddedFailClassification ?? searchParams.get("fail_cls") ?? "").trim();

  const isFailMode = Boolean(urlFailQ || urlFailCls);

  // ✅ si no hay histTemplateId, pon el primero
  useEffect(() => {
    if (!histTemplateId && templates.length > 0) {
      setHistTemplateId(templates[0].id);
    }
  }, [templates, histTemplateId]);

  // -------------------------
  // Query helpers
  // -------------------------
  async function fetchRunsByPeriodAndViewAndFail() {
    if (!areaId) return;
    if (!activeHotelId) {
      setHistError("No hay hotel activo seleccionado.");
      setHistRuns([]);
      return;
    }

    setHistLoading(true);
    setHistError(null);

    try {
      const { startMs, endMs } = getPeriodRange(new Date(), urlPeriod as PeriodKey);
      const startISO = new Date(startMs).toISOString();
      const endISO = new Date(endMs).toISOString();

      // 1) Runs base (submitted + area + rango + (vista opcional))
      let q = supabase
        .from("audit_runs")
        .select("id,status,score,notes,executed_at,executed_by,audit_template_id,area_id")
        .eq("hotel_id", activeHotelId)
        .eq("area_id", areaId)
        .is("archived_at", null)
        .eq("status", "submitted")
        .gte("executed_at", startISO)
        .lte("executed_at", endISO)
        .order("executed_at", { ascending: false })
        .limit(100);

      if (urlTemplate !== "ALL") {
        q = q.eq("audit_template_id", urlTemplate);
      }

      const { data: runsData, error: runsErr } = await q;
      if (runsErr) throw runsErr;

      const runs = (runsData ?? []) as AuditRunRow[];
      if (runs.length === 0) {
        if (!mountedRef.current) return;
        setHistRuns([]);
        return;
      }

      // 2) Si no hay filtro de fail (por seguridad), lista directa
      if (!urlFailQ && !urlFailCls) {
        if (!mountedRef.current) return;
        setHistRuns(runs);
        return;
      }

      // 3) Filtrar por FAIL: buscamos audit_answers FAIL de esos runs
      const runIds = runs.map((r) => r.id);

      let aQ = supabase
        .from("audit_answers")
        .select("audit_run_id,question_id,result")
        .in("audit_run_id", runIds)
        .eq("result", "FAIL");

      if (urlFailQ) {
        aQ = aQ.eq("question_id", urlFailQ);
      }

      const { data: ansData, error: ansErr } = await aQ;
      if (ansErr) throw ansErr;

      type AnswerResultRow = { audit_run_id: string; question_id: string; result: string | null };
      const answers = (ansData ?? []) as AnswerResultRow[];

      // si es por clasificación, necesitamos mapear question_id -> classification
      let allowedRunIds = new Set<string>();

      if (urlFailCls) {
        const qIds = Array.from(new Set(answers.map((a) => a.question_id).filter(Boolean)));

        if (qIds.length === 0) {
          if (!mountedRef.current) return;
          setHistRuns([]);
          return;
        }

        const { data: qData, error: qErr } = await supabase
          .from("audit_questions")
          .select(`
            id,
            classification,
            audit_section_id,
            audit_sections (
              name
            )
          `)
          .in("id", qIds);

        if (qErr) throw qErr;

        type QuestionClassRow = {
          id: string;
          classification: string | null;
          audit_section_id: string | null;
          audit_sections: { name: string } | null;
        };
        const clsByQ: Record<string, string> = {};
        for (const row of (qData ?? []) as QuestionClassRow[]) {
          const sectionName = String(row.audit_sections?.name ?? "Sin sección");
          clsByQ[row.id] = String(row.classification ?? "").trim() || sectionName;
        }

        for (const a of answers) {
          const cls = (clsByQ[a.question_id] ?? "").trim() || "Sin clasificación";
          if (cls === urlFailCls) allowedRunIds.add(a.audit_run_id);
        }
      } else {
        // filtro solo por question_id
        for (const a of answers) allowedRunIds.add(a.audit_run_id);
      }

      const filtered = runs.filter((r) => allowedRunIds.has(r.id));
      if (!mountedRef.current) return;
      setHistRuns(filtered);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setHistError(e?.message ?? "No se pudo cargar el historial filtrado.");
      setHistRuns([]);
    } finally {
      if (mountedRef.current) setHistLoading(false);
    }
  }

  async function handleSearchHistoryMonthMode() {
    if (!areaId || !histTemplateId) return;
    if (!activeHotelId) {
      setHistError("No hay hotel activo seleccionado.");
      setHistRuns([]);
      return;
    }

    setHistLoading(true);
    setHistError(null);

    try {
      const { start, end } = monthStartEndISO(histYear, histMonth);

      const { data, error: rErr } = await supabase
        .from("audit_runs")
        .select("id,status,score,notes,executed_at,executed_by,audit_template_id,area_id")
        .eq("hotel_id", activeHotelId)
        .eq("area_id", areaId)
        .is("archived_at", null)
        .eq("status", "submitted")
        .eq("audit_template_id", histTemplateId)
        .gte("executed_at", start)
        .lt("executed_at", end)
        .order("executed_at", { ascending: false })
        .limit(100);

      if (rErr) throw rErr;

      setHistRuns((data ?? []) as AuditRunRow[]);
    } catch (e: any) {
      setHistError(e?.message ?? "No se pudo buscar el historial.");
      setHistRuns([]);
    } finally {
      setHistLoading(false);
    }
  }

  async function handleDeleteAudit(runId: string) {
    if (!showDelete) return;

    const ok = window.confirm(
      "¿Seguro que quieres borrar esta auditoría?\n\nEsto eliminará el registro y sus respuestas. No se puede deshacer."
    );
    if (!ok) return;

    setDeletingRunId(runId);
    setHistError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesión inválida.");

      const response = await fetch(`/api/audit-runs/${runId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo borrar la auditoría.");
      }

      setHistRuns((prev) => prev.filter((x) => x.id !== runId));
      onDeleteSuccess(runId);
    } catch (e: any) {
      setHistError(e?.message ?? "No se pudo borrar la auditoría.");
    } finally {
      setDeletingRunId(null);
    }
  }

  // ✅ auto-carga cuando vienes del dashboard con fail filters
  useEffect(() => {
    if (!areaId) return;
    if (!isFailMode) return;
    if (!activeHotelId) return;
    fetchRunsByPeriodAndViewAndFail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId, activeHotelId, urlTemplate, urlPeriod, urlFailQ, urlFailCls]);

  const activeChips = useMemo(() => {
    const out: { label: string }[] = [];
    if (!isFailMode) return out;

    out.push({ label: t("chipPeriod", { period: String(urlPeriod) }) });
    out.push({ label: urlTemplate === "ALL" ? t("chipViewAll") : t("chipViewFiltered") });

    if (urlFailQ) out.push({ label: t("chipStandard") });
    if (urlFailCls) out.push({ label: t("chipClassification", { cls: urlFailCls }) });

    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFailMode, urlPeriod, urlTemplate, urlFailQ, urlFailCls, t]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card data-onboarding="historial-filters">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 20, fontWeight: 950 }}>{t("title")}</div>

          {isFailMode ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {activeChips.map((c, idx) => (
                <span key={`${c.label}-${idx}`} style={chipStyle()}>
                  {c.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* ✅ MODO FILTRADO (desde dashboard) */}
        {isFailMode ? (
          <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13, fontWeight: 900 }}>
            {t.rich("failModeDesc", { b: (chunks) => <strong>{chunks}</strong> })}
          </div>
        ) : null}

        {/* ✅ MODO CLÁSICO (mes/año) */}
        {!isFailMode ? (
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              alignItems: "end",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.75, marginBottom: 6 }}>{t("templateLabel")}</div>
              <select value={histTemplateId} onChange={(e) => setHistTemplateId(e.target.value)} style={inputStyle}>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
                {templates.length === 0 ? <option value="">{t("noTemplates")}</option> : null}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.75, marginBottom: 6 }}>{t("yearLabel")}</div>
              <select value={histYear} onChange={(e) => setHistYear(Number(e.target.value))} style={inputStyle}>
                {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.75, marginBottom: 6 }}>{t("monthLabel")}</div>
              <select value={histMonth} onChange={(e) => setHistMonth(Number(e.target.value))} style={inputStyle}>
                {Array.from({ length: 12 }, (_, m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={handleSearchHistoryMonthMode} style={primaryBtn} disabled={!histTemplateId || histLoading}>
                {histLoading ? t("searching") : t("search")}
              </button>
              <button
                onClick={() => {
                  setHistRuns([]);
                  setHistError(null);
                }}
                style={ghostBtn}
                disabled={histLoading}
              >
                {t("clear")}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={fetchRunsByPeriodAndViewAndFail} style={primaryBtn} disabled={histLoading}>
              {histLoading ? t("loading") : t("refresh")}
            </button>
            <button
              onClick={() => {
                // Solo limpiamos resultados en modo filtrado
                setHistRuns([]);
                setHistError(null);
              }}
              style={ghostBtn}
              disabled={histLoading}
            >
              {t("clear")}
            </button>
          </div>
        )}

        {histError ? <div style={{ marginTop: 12, color: "crimson", fontWeight: 900 }}>{histError}</div> : null}
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>{t("results")}</div>
          {histLoading ? (
            <div style={{ fontWeight: 900, opacity: 0.75 }}>{t("loading")}</div>
          ) : (
            <div style={{ fontWeight: 900, opacity: 0.75 }}>{t("auditCount", { count: histRuns.length })}</div>
          )}
        </div>

        {histRuns.length === 0 ? (
          <div style={{ opacity: 0.8 }}>
            {isFailMode ? (
              <>{t.rich("noFailAudits", { b: (chunks) => <strong>{chunks}</strong> })}</>
            ) : (
              <>{t.rich("noAudits", { b: (chunks) => <strong>{chunks}</strong> })}</>
            )}
          </div>
        ) : (
          <div data-onboarding="historial-list" style={{ display: "grid", gap: 12 }}>
            {histRuns.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 14,
                  background: "rgba(255,255,255,0.04)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontWeight: 950 }}>{fmtDate(r.executed_at)}</div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>
                    Score:{" "}
                    <span style={{ fontWeight: 950, color: scoreColor(r.score) }}>
                      {r.score === null ? "—" : `${Number(r.score).toFixed(2)}%`}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => onViewRun(r.id)} style={primaryBtn}>
                    {t("viewAudit")}
                  </button>
                  <button
                    onClick={() => router.push(`/reports/audit/${r.id}`)}
                    style={ghostBtn}
                  >
                    {t("viewReport")}
                  </button>

                  {showDelete ? (
                    <button
                      onClick={() => handleDeleteAudit(r.id)}
                      style={dangerBtn}
                      disabled={deletingRunId === r.id}
                      title={t("deleteAudit")}
                    >
                      {deletingRunId === r.id ? t("deleting") : t("delete")}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
