// FILE: app/(app)/areas/[areaId]/_components/DashboardPanel.tsx
"use client";

import type {
  AnswerRow,
  AuditRunRow,
  AuditTemplate,
  PeriodKey,
  QuestionMeta,
  SectionTotal,
} from "../_lib/areaTypes";
import { clamp, fmtDate, getPeriodRange, periodLabel, scoreColor } from "../_lib/areaUtils";
import Sparkline from "./Sparkline";

const card: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.75)",
  padding: 18,
};

function pillStyle(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#fff",
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  };
}

export default function DashboardPanel({
  period,
  setPeriod,
  templateFilter,
  setTemplateFilter,
  templates,
  templateNameById,
  totalsByTemplate,
  exceptionsByRun,
  runs,
  answersByRun,
  questionMetaById,
  onViewRun,
  onOpenFailRuns,
}: {
  period: PeriodKey;
  setPeriod: (p: PeriodKey) => void;
  templateFilter: string;
  setTemplateFilter: (v: string) => void;
  templates: AuditTemplate[];
  templateNameById: Record<string, string>;
  totalsByTemplate: Record<string, Record<string, SectionTotal>>;
  exceptionsByRun: Record<string, Record<string, { fail: number; na: number }>>;
  runs: AuditRunRow[];
  answersByRun: Record<string, AnswerRow[]>;
  questionMetaById: Record<string, QuestionMeta>;
  onViewRun: (runId: string) => void;

  // ✅ NUEVO: para ir al historial filtrado
  onOpenFailRuns?: (payload: { questionId?: string; classification?: string }) => void;
}) {
  const WINDOW = 4;
  const { startMs, endMs } = getPeriodRange(new Date(), period);

  const base = runs
    .filter((r) => (r.status ?? "").toLowerCase() === "submitted")
    .filter((r) => typeof r.score === "number" && r.executed_at)
    .filter((r) => (templateFilter === "ALL" ? true : r.audit_template_id === templateFilter))
    .filter((r) => {
      const t = r.executed_at ? new Date(r.executed_at).getTime() : 0;
      return t >= startMs && t <= endMs;
    });

  const sorted = [...base].sort((a, b) => {
    const ta = a.executed_at ? new Date(a.executed_at).getTime() : 0;
    const tb = b.executed_at ? new Date(b.executed_at).getTime() : 0;
    return tb - ta;
  });

  const lastN = sorted.slice(0, WINDOW);
  const lastRun = sorted[0] ?? null;

  const avgScore =
    lastN.length === 0
      ? null
      : Math.round((lastN.reduce((sum, r) => sum + (Number(r.score) || 0), 0) / lastN.length) * 100) / 100;

  const trendRuns = [...sorted].slice(0, 12).reverse();
  const trendValues = trendRuns
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n))
    .map((n) => clamp(n, 0, 100));

  // -------------------------
  // Ranking secciones (sobre lastN)
  // -------------------------
  const sectionStats: Record<string, { name: string; scores: number[] }> = {};

  for (const run of lastN) {
    const totals = totalsByTemplate[run.audit_template_id] ?? {};
    const exceptions = exceptionsByRun[run.id] ?? {};

    for (const secId of Object.keys(totals)) {
      const t = totals[secId];
      const fail = exceptions[secId]?.fail ?? 0;
      const na = exceptions[secId]?.na ?? 0;

      const totalQ = t?.total_questions ?? 0;
      const denom = Math.max(0, totalQ - na);
      const pass = Math.max(0, denom - fail);
      const score = denom === 0 ? null : (pass / denom) * 100;

      const sectionName = t?.section_name ?? "Sin sección";
      if (!sectionStats[sectionName]) sectionStats[sectionName] = { name: sectionName, scores: [] };
      if (score !== null) sectionStats[sectionName].scores.push(score);
    }
  }

  const sectionRanking = Object.values(sectionStats)
    .map((s) => {
      const avg =
        s.scores.length === 0
          ? null
          : Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 100) / 100;
      return { section_name: s.name, avg_score: avg };
    })
    .sort((a, b) => {
      const av = a.avg_score ?? 9999;
      const bv = b.avg_score ?? 9999;
      return av - bv;
    });

  const worstSection = sectionRanking.find((x) => x.avg_score !== null) ?? null;
  const bestSection = [...sectionRanking].reverse().find((x) => x.avg_score !== null) ?? null;

  const filterLabel =
    templateFilter === "ALL"
      ? "General (todas)"
      : templateNameById[templateFilter] ?? templates.find((t) => t.id === templateFilter)?.name ?? "Plantilla";

  // -------------------------
  // ✅ Ranking FAIL (sobre base = Vista+Periodo)
  // -------------------------
  const runIdsInScope = new Set(base.map((r) => r.id));

  const failByQuestion: Record<string, number> = {};
  const failByClassification: Record<string, number> = {};

  for (const runId of runIdsInScope) {
    const ans = answersByRun[runId] ?? [];
    for (const a of ans) {
      const res = String(a.result ?? "").toUpperCase();
      if (res !== "FAIL") continue;

      const qId = a.question_id;
      if (!qId) continue;

      failByQuestion[qId] = (failByQuestion[qId] ?? 0) + 1;

      const meta = questionMetaById[qId];
      const cls = (meta?.classification ?? "").trim() || "Sin clasificación";
      failByClassification[cls] = (failByClassification[cls] ?? 0) + 1;
    }
  }

  const topStandards = Object.entries(failByQuestion)
    .map(([questionId, fails]) => {
      const meta = questionMetaById[questionId];
      return {
        questionId,
        fails,
        text: meta?.text ?? "—",
        tag: meta?.tag ?? null,
        classification: meta?.classification ?? null,
      };
    })
    .sort((a, b) => b.fails - a.fails)
    .slice(0, 10);

  const topClassifications = Object.entries(failByClassification)
    .map(([classification, fails]) => ({ classification, fails }))
    .sort((a, b) => b.fails - a.fails)
    .slice(0, 10);

  const clickableRow: React.CSSProperties = {
    cursor: onOpenFailRuns ? "pointer" : "default",
    transition: "transform 120ms ease, box-shadow 120ms ease",
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 950 }}>Dashboard por área</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900, opacity: 0.9 }}>Periodo:</div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodKey)}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "2px solid rgba(255,0,150,0.20)",
                outline: "none",
                minWidth: 220,
                fontWeight: 900,
                background: "#fff",
              }}
            >
              <option value="THIS_MONTH">Este mes</option>
              <option value="LAST_3_MONTHS">3 últimos meses</option>
              <option value="THIS_YEAR">Año</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900, opacity: 0.9 }}>Vista:</div>
            <select
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "2px solid rgba(255,0,150,0.35)",
                outline: "none",
                minWidth: 260,
                fontWeight: 900,
                background: "#fff",
              }}
            >
              <option value="ALL">General (todas)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cards resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <div style={card}>
          <div style={{ fontWeight: 950, marginBottom: 6 }}>Score promedio (últimas {lastN.length || 0})</div>
          <div style={{ fontSize: 34, fontWeight: 950, color: scoreColor(avgScore) }}>
            {avgScore === null ? "—" : `${avgScore.toFixed(2)}%`}
          </div>

          <div style={{ marginTop: 10, opacity: 0.85, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 900 }}>Tendencia</span>
            <span style={{ color: scoreColor(avgScore), display: "inline-flex" }}>
              <Sparkline values={trendValues} />
            </span>
          </div>

          <div style={{ marginTop: 8, fontSize: 12.5, opacity: 0.75 }}>
            Vista: <strong>{filterLabel}</strong> · Periodo: <strong>{periodLabel(period)}</strong>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 950, marginBottom: 6 }}>Última auditoría</div>
          {lastRun ? (
            <>
              <div style={{ fontWeight: 900 }}>
                {templateNameById[lastRun.audit_template_id] ?? lastRun.audit_template_id}
              </div>
              <div style={{ opacity: 0.85, marginTop: 4 }}>
                {fmtDate(lastRun.executed_at)} ·{" "}
                <span style={{ fontWeight: 950, color: scoreColor(lastRun.score) }}>
                  {lastRun.score === null ? "—" : `${Number(lastRun.score).toFixed(2)}%`}
                </span>
              </div>

              <button
                onClick={() => onViewRun(lastRun.id)}
                style={{
                  marginTop: 10,
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.2)",
                  background: "#000",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Ver auditoría
              </button>
            </>
          ) : (
            <div style={{ opacity: 0.8 }}>No hay auditorías enviadas todavía.</div>
          )}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 950, marginBottom: 6 }}>Sección más débil</div>
          {worstSection?.avg_score !== null ? (
            <>
              <div style={{ fontWeight: 900 }}>{worstSection?.section_name}</div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 28,
                  fontWeight: 950,
                  color: scoreColor(worstSection?.avg_score ?? null),
                }}
              >
                {worstSection?.avg_score?.toFixed(2)}%
              </div>
            </>
          ) : (
            <div style={{ opacity: 0.8 }}>—</div>
          )}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 950, marginBottom: 6 }}>Sección más fuerte</div>
          {bestSection?.avg_score !== null ? (
            <>
              <div style={{ fontWeight: 900 }}>{bestSection?.section_name}</div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 28,
                  fontWeight: 950,
                  color: scoreColor(bestSection?.avg_score ?? null),
                }}
              >
                {bestSection?.avg_score?.toFixed(2)}%
              </div>
            </>
          ) : (
            <div style={{ opacity: 0.8 }}>—</div>
          )}
        </div>
      </div>

      {/* ✅ Ranking FAIL */}
      <div style={card}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 16 }}>Ranking de FAIL (según Vista + Periodo)</div>
          <div style={{ opacity: 0.75, fontSize: 12.5, fontWeight: 900 }}>
            Base: <strong>{base.length}</strong> auditorías
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Izquierda: estándares */}
          <div>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Estándares con más FAIL</div>

            {topStandards.length === 0 ? (
              <div style={{ opacity: 0.75, fontWeight: 800 }}>—</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {topStandards.map((s) => (
                  <div
                    key={s.questionId}
                    style={{
                      ...clickableRow,
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 14,
                      background: "rgba(0,0,0,0.02)",
                      padding: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                    onClick={() => onOpenFailRuns?.({ questionId: s.questionId })}
                    role={onOpenFailRuns ? "button" : undefined}
                    tabIndex={onOpenFailRuns ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (!onOpenFailRuns) return;
                      if (e.key === "Enter" || e.key === " ") onOpenFailRuns({ questionId: s.questionId });
                    }}
                    title={onOpenFailRuns ? "Ver auditorías donde falló este estándar" : undefined}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 950,
                          fontSize: 13.5,
                          lineHeight: 1.25,
                          wordBreak: "break-word",
                        }}
                      >
                        {s.text}
                      </div>

                      <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", opacity: 0.9 }}>
                        {s.tag ? <span style={pillStyle()}>Tag: {s.tag}</span> : null}
                        {s.classification ? (
                          <span style={pillStyle()}>Clasificación: {s.classification}</span>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      <span style={{ ...pillStyle(), borderColor: "rgba(176,0,32,0.25)", color: "#b00020" }}>
                        {s.fails} FAIL
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Derecha: clasificaciones */}
          <div>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Clasificaciones con más FAIL</div>

            {topClassifications.length === 0 ? (
              <div style={{ opacity: 0.75, fontWeight: 800 }}>—</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {topClassifications.map((c) => (
                  <div
                    key={c.classification}
                    style={{
                      ...clickableRow,
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 14,
                      background: "rgba(0,0,0,0.02)",
                      padding: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                    }}
                    onClick={() => onOpenFailRuns?.({ classification: c.classification })}
                    role={onOpenFailRuns ? "button" : undefined}
                    tabIndex={onOpenFailRuns ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (!onOpenFailRuns) return;
                      if (e.key === "Enter" || e.key === " ") onOpenFailRuns({ classification: c.classification });
                    }}
                    title={onOpenFailRuns ? "Ver auditorías donde falló esta clasificación" : undefined}
                  >
                    <div style={{ fontWeight: 950, fontSize: 13.5, minWidth: 0, wordBreak: "break-word" }}>
                      {c.classification}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <span style={{ ...pillStyle(), borderColor: "rgba(176,0,32,0.25)", color: "#b00020" }}>
                        {c.fails} FAIL
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {onOpenFailRuns ? (
          <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 900, opacity: 0.65 }}>
            Tip: haz click en un estándar o clasificación para ver las auditorías relacionadas (y revisar comentarios/fotos).
          </div>
        ) : null}
      </div>

      <div style={{ opacity: 0.75, fontSize: 13 }}>
        Nota: el dashboard se calcula con auditorías <strong>submitted</strong> con score, filtrando por{" "}
        <strong>periodo</strong> y opcionalmente por <strong>plantilla</strong>.
      </div>
    </div>
  );
}