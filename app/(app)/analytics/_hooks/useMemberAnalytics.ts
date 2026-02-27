// FILE: app/(app)/analytics/_hooks/useMemberAnalytics.ts
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type {
  AnswerRowLite,
  AuditRunRow,
  MemberReport,
  MemberTopStandardRow,
  MemberTrendRow,
  QuestionLite,
  TemplateLite,
} from "../_lib/analyticsTypes";
import { pct, safeVal } from "../_lib/analyticsUtils";

export function useMemberAnalytics({
  hotelId,
  selectedAreaId,
  fromISO,
  toISO,
  selectedMemberId,
  memberAuditMode,
  templates,
}: {
  hotelId: string | null;
  selectedAreaId: string;
  fromISO: string;
  toISO: string;
  selectedMemberId: string;
  memberAuditMode: string;
  templates: TemplateLite[];
}) {
  const [report, setReport] = useState<MemberReport | null>(null);
  const [trend, setTrend] = useState<MemberTrendRow[]>([]);
  const [topStandards, setTopStandards] = useState<MemberTopStandardRow[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!hotelId || !selectedAreaId) return;

      if (!selectedMemberId) {
        setReport(null);
        setTrend([]);
        setTopStandards([]);
        return;
      }

      try {
        const { data: runsData, error: runsErr } = await supabase
          .from("audit_runs")
          .select("id,executed_at,team_member_id,area_id,status,hotel_id,audit_template_id")
          .eq("hotel_id", hotelId)
          .eq("area_id", selectedAreaId)
          .eq("status", "submitted")
          .eq("team_member_id", selectedMemberId)
          .gte("executed_at", fromISO)
          .lte("executed_at", toISO)
          .order("executed_at", { ascending: true });

        if (runsErr) throw runsErr;

        const runsMemberAll = (runsData ?? []) as AuditRunRow[];
        if (!alive) return;

        // Mapa de nombres
        const templateNameById = new Map<string, string>();
        templates.forEach((t) => templateNameById.set(t.id, t.name));

        // ✅ Aplicamos filtro de auditoría seleccionado
        const runsMember =
          memberAuditMode === "all"
            ? runsMemberAll
            : runsMemberAll.filter((r) => r.audit_template_id === memberAuditMode);

        // ✅ Si con el filtro seleccionado no hay auditorías, debe salir 0
        if (runsMember.length === 0) {
          setReport({ audits_count: 0, overall_fail_pct: null, by_template: [] });
          setTrend([]);
          setTopStandards([]);
          return;
        }

        // Para respuestas: necesitamos todas las del colaborador en periodo
        // (así no hacemos otra query dependiendo del filtro), pero luego agregamos SOLO las filtradas.
        const runIdsMemberAll = runsMemberAll.map((r) => r.id);
        const runIdsSelected = new Set(runsMember.map((r) => r.id));

        const { data: ansData, error: ansErr } = await supabase
          .from("audit_answers")
          .select("audit_run_id,question_id,answer,result")
          .in("audit_run_id", runIdsMemberAll);

        if (ansErr) throw ansErr;

        const answers: AnswerRowLite[] = (ansData ?? []).map((a: any) => ({
          audit_run_id: a.audit_run_id,
          question_id: a.question_id,
          answer: safeVal(a.answer),
          result: safeVal(a.result),
        }));

        const qIds = Array.from(new Set(answers.map((a) => a.question_id).filter(Boolean)));
        const { data: qData, error: qErr } = await supabase
          .from("audit_questions")
          .select("id,text,tag,classification")
          .in("id", qIds);

        if (qErr) throw qErr;

        const qById = new Map<string, QuestionLite>();
        (qData ?? []).forEach((q: any) => qById.set(q.id, q as QuestionLite));

        // =========================================================
        // ✅ INFORME SOLO DEL FILTRO SELECCIONADO
        // =========================================================
        const auditsCount = runsMember.length;

        // Respondidas/fallos por run (de todo el periodo), luego se filtra por runIdsSelected
        const answeredByRun = new Map<string, { answered: number; fails: number }>();

        for (const a of answers) {
          const val = (a.result ?? a.answer) as "PASS" | "FAIL" | "NA" | null;
          if (val !== "PASS" && val !== "FAIL" && val !== "NA") continue;
          if (val === "NA") continue;

          const cur = answeredByRun.get(a.audit_run_id) ?? { answered: 0, fails: 0 };
          cur.answered += 1;
          if (val === "FAIL") cur.fails += 1;
          answeredByRun.set(a.audit_run_id, cur);
        }

        // ✅ Overall SOLO con runs filtradas
        let overallAnswered = 0;
        let overallFails = 0;

        for (const [runId, v] of answeredByRun.entries()) {
          if (!runIdsSelected.has(runId)) continue;
          overallAnswered += v.answered;
          overallFails += v.fails;
        }

        const overallFailPct = overallAnswered ? pct(overallFails, overallAnswered) : null;

        // Distribución por tipo:
        // - Si "all": distribuimos dentro del periodo (pero sigue siendo "seleccionado" porque seleccionaste "todas")
        // - Si tipo concreto: no aporta, devolvemos []
        let byTemplateRows: MemberReport["by_template"] = [];

        if (memberAuditMode === "all") {
          const auditsByTemplate = new Map<
            string | null,
            { audits: number; answered: number; fails: number }
          >();

          // auditorías por template SOLO de runsMember (que aquí == runsMemberAll)
          for (const r of runsMember) {
            const key = r.audit_template_id ?? null;
            const cur = auditsByTemplate.get(key) ?? { audits: 0, answered: 0, fails: 0 };
            cur.audits += 1;
            auditsByTemplate.set(key, cur);
          }

          // sumar answered/fails por template SOLO de runsMember
          const runTemplateById = new Map<string, string | null>();
          runsMember.forEach((r) => runTemplateById.set(r.id, r.audit_template_id ?? null));

          for (const r of runsMember) {
            const v = answeredByRun.get(r.id) ?? { answered: 0, fails: 0 };
            const tId = runTemplateById.get(r.id) ?? null;
            const cur = auditsByTemplate.get(tId) ?? { audits: 0, answered: 0, fails: 0 };
            cur.answered += v.answered;
            cur.fails += v.fails;
            auditsByTemplate.set(tId, cur);
          }

          byTemplateRows = Array.from(auditsByTemplate.entries())
            .map(([template_id, v]) => {
              const template_name = template_id
                ? templateNameById.get(template_id) ?? "—"
                : "Sin tipo";
              return {
                template_id,
                template_name,
                audits_count: v.audits,
                audits_pct: pct(v.audits, auditsCount),
                fail_pct: v.answered ? pct(v.fails, v.answered) : null,
              };
            })
            .sort((a, b) => b.audits_count - a.audits_count);
        }

        // Trend (según filtro)
        const trendRows: MemberTrendRow[] = runsMember.map((r) => {
          const v = answeredByRun.get(r.id) ?? { answered: 0, fails: 0 };
          const templateName = r.audit_template_id
            ? templateNameById.get(r.audit_template_id) ?? "—"
            : "Sin tipo";
          return {
            run_id: r.id,
            executed_at: r.executed_at,
            template_name: templateName,
            answered: v.answered,
            fails: v.fails,
            fail_pct: v.answered ? pct(v.fails, v.answered) : null,
          };
        });

        // Top estándares (según filtro)
        const failAgg = new Map<string, number>();
        for (const a of answers) {
          if (!runIdsSelected.has(a.audit_run_id)) continue;
          const val = (a.result ?? a.answer) as "PASS" | "FAIL" | "NA" | null;
          if (val !== "FAIL") continue;
          failAgg.set(a.question_id, (failAgg.get(a.question_id) ?? 0) + 1);
        }

        const top: MemberTopStandardRow[] = Array.from(failAgg.entries())
          .map(([question_id, fail_count]) => {
            const q = qById.get(question_id);
            return {
              question_id,
              standard: q?.text ?? "—",
              tag: q?.tag ?? null,
              classification: q?.classification ?? null,
              fail_count,
            };
          })
          .sort((a, b) => b.fail_count - a.fail_count)
          .slice(0, 20);

        if (!alive) return;

        setReport({
          audits_count: auditsCount,
          overall_fail_pct: overallFailPct,
          by_template: byTemplateRows,
        });
        setTrend(trendRows);
        setTopStandards(top);
      } catch {
        if (!alive) return;
        setReport(null);
        setTrend([]);
        setTopStandards([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [hotelId, selectedAreaId, fromISO, toISO, selectedMemberId, memberAuditMode, templates]);

  return { report, trend, topStandards };
}