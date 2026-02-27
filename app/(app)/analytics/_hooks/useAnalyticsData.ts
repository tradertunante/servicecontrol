"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type {
  AnswerRowLite,
  AuditRunRow,
  CommonStandardRow,
  QuestionLite,
  RankingRow,
  SortDir,
  SortKey,
  TeamMemberLite,
  TemplateLite,
} from "../_lib/analyticsTypes";
import { pct, safeVal } from "../_lib/analyticsUtils";

export function useAnalyticsData({
  hotelId,
  selectedAreaId,
  fromISO,
  toISO,
  rankingMode,
  onFirstMemberAutoSelect,
}: {
  hotelId: string | null;
  selectedAreaId: string;
  fromISO: string;
  toISO: string;
  rankingMode: string;
  onFirstMemberAutoSelect?: (firstId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateLite[]>([]);
  const [membersForArea, setMembersForArea] = useState<TeamMemberLite[]>([]);

  const [rankingRaw, setRankingRaw] = useState<RankingRow[]>([]);
  const [commonByPeople, setCommonByPeople] = useState<CommonStandardRow[]>([]);
  const [commonByFails, setCommonByFails] = useState<CommonStandardRow[]>([]);

  const [sortKey, setSortKey] = useState<SortKey>("fail_rate_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(nextKey: SortKey) {
    setSortKey((prevKey) => {
      if (prevKey !== nextKey) {
        setSortDir("desc");
        return nextKey;
      }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return prevKey;
    });
  }

  const ranking = useMemo(() => {
    const arr = [...rankingRaw];
    const dirMul = sortDir === "asc" ? 1 : -1;

    const cmpStr = (a: string, b: string) =>
      a.localeCompare(b, "es-ES", { sensitivity: "base" }) * dirMul;

    const cmpNum = (a: number | null, b: number | null) => {
      const av = a ?? -Infinity;
      const bv = b ?? -Infinity;
      if (av === bv) return 0;
      return av > bv ? 1 * dirMul : -1 * dirMul;
    };

    const cmpDate = (a: string | null, b: string | null) => {
      const av = a ? new Date(a).getTime() : -Infinity;
      const bv = b ? new Date(b).getTime() : -Infinity;
      if (av === bv) return 0;
      return av > bv ? 1 * dirMul : -1 * dirMul;
    };

    arr.sort((x, y) => {
      if (sortKey === "name") return cmpStr(x.name ?? "", y.name ?? "");
      if (sortKey === "audits_count") return cmpNum(x.audits_count, y.audits_count);
      if (sortKey === "fail_rate_pct") return cmpNum(x.fail_rate_pct, y.fail_rate_pct);
      return cmpDate(x.last_audit_at, y.last_audit_at);
    });

    return arr;
  }, [rankingRaw, sortKey, sortDir]);

  useEffect(() => {
    setSortKey("fail_rate_pct");
    setSortDir("desc");
  }, [rankingMode, selectedAreaId, fromISO, toISO]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!hotelId) return;
      if (!selectedAreaId) return;

      setBusy(true);
      setError(null);

      try {
        // 1) Runs del área en el periodo
        const { data: runsData, error: runsErr } = await supabase
          .from("audit_runs")
          .select("id,executed_at,team_member_id,area_id,status,hotel_id,audit_template_id")
          .eq("hotel_id", hotelId)
          .eq("area_id", selectedAreaId)
          .eq("status", "submitted")
          .not("team_member_id", "is", null)
          .gte("executed_at", fromISO)
          .lte("executed_at", toISO)
          .order("executed_at", { ascending: false });

        if (runsErr) throw runsErr;

        const runsAll = (runsData ?? []) as AuditRunRow[];

        if (runsAll.length === 0) {
          if (!alive) return;
          setTemplates([]);
          setMembersForArea([]);
          setRankingRaw([]);
          setCommonByPeople([]);
          setCommonByFails([]);
          setBusy(false);
          return;
        }

        const runIdsAll = runsAll.map((r) => r.id);

        // 2) Templates disponibles
        const templateIds = Array.from(
          new Set(runsAll.map((r) => r.audit_template_id).filter(Boolean))
        ) as string[];

        let templateList: TemplateLite[] = [];
        if (templateIds.length > 0) {
          const { data: tData, error: tErr } = await supabase
            .from("audit_templates")
            .select("id,name")
            .in("id", templateIds);

          if (tErr) throw tErr;
          templateList = (tData ?? []) as TemplateLite[];
          templateList.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "es-ES"));
        }

        // 3) Answers de todas las runs
        const { data: ansData, error: ansErr } = await supabase
          .from("audit_answers")
          .select("audit_run_id,question_id,answer,result")
          .in("audit_run_id", runIdsAll);

        if (ansErr) throw ansErr;

        const answersLite: AnswerRowLite[] = (ansData ?? []).map((a: any) => ({
          audit_run_id: a.audit_run_id,
          question_id: a.question_id,
          answer: safeVal(a.answer),
          result: safeVal(a.result),
        }));

        // 4) Preguntas
        const qIds = Array.from(new Set(answersLite.map((a) => a.question_id).filter(Boolean)));
        const { data: qData, error: qErr } = await supabase
          .from("audit_questions")
          .select("id,text,tag,classification")
          .in("id", qIds);

        if (qErr) throw qErr;

        const qById = new Map<string, QuestionLite>();
        (qData ?? []).forEach((q: any) => qById.set(q.id, q as QuestionLite));

        // 5) Team members (dropdown)
        const memberIds = Array.from(new Set(runsAll.map((r) => r.team_member_id).filter(Boolean))) as string[];
        const { data: tmData, error: tmErr } = await supabase
          .from("team_members")
          .select("id,full_name,position,employee_number")
          .in("id", memberIds);

        if (tmErr) throw tmErr;

        const tmById = new Map<string, TeamMemberLite>();
        (tmData ?? []).forEach((tm: any) => tmById.set(tm.id, tm as TeamMemberLite));

        const membersSorted = (tmData ?? [])
          .map((x: any) => x as TeamMemberLite)
          .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "es-ES", { sensitivity: "base" }));

        // autoselect first member if provided
        if (onFirstMemberAutoSelect && membersSorted.length > 0) {
          onFirstMemberAutoSelect(membersSorted[0].id);
        }

        // Maps
        const memberByRun = new Map<string, string>();
        for (const r of runsAll) {
          if (r.team_member_id) memberByRun.set(r.id, r.team_member_id);
        }

        // -------------------------
        // A) Ranking (respeta rankingMode)
        // -------------------------
        const runsForRanking =
          rankingMode === "all" ? runsAll : runsAll.filter((r) => r.audit_template_id === rankingMode);
        const runIdsForRanking = new Set(runsForRanking.map((r) => r.id));

        const auditsByMemberRanking = new Map<string, number>();
        for (const r of runsForRanking) {
          if (!r.team_member_id) continue;
          auditsByMemberRanking.set(r.team_member_id, (auditsByMemberRanking.get(r.team_member_id) ?? 0) + 1);
        }

        const agg = new Map<string, { answered: number; fails: number }>();
        for (const a of answersLite) {
          if (!runIdsForRanking.has(a.audit_run_id)) continue;
          const memberId = memberByRun.get(a.audit_run_id);
          if (!memberId) continue;

          const val = (a.result ?? a.answer) as "PASS" | "FAIL" | "NA" | null;
          if (val !== "PASS" && val !== "FAIL" && val !== "NA") continue;
          if (val === "NA") continue;

          const cur = agg.get(memberId) ?? { answered: 0, fails: 0 };
          cur.answered += 1;
          if (val === "FAIL") cur.fails += 1;
          agg.set(memberId, cur);
        }

        const lastByMember = new Map<string, string>();
        for (const r of runsForRanking) {
          if (!r.team_member_id || !r.executed_at) continue;
          const prev = lastByMember.get(r.team_member_id);
          if (!prev || new Date(r.executed_at).getTime() > new Date(prev).getTime()) {
            lastByMember.set(r.team_member_id, r.executed_at);
          }
        }

        const rankingList: RankingRow[] = Array.from(
          new Set([...Array.from(agg.keys()), ...Array.from(auditsByMemberRanking.keys())])
        ).map((memberId) => {
          const tm = tmById.get(memberId);
          const v = agg.get(memberId) ?? { answered: 0, fails: 0 };
          const failRate = v.answered ? pct(v.fails, v.answered) : null;

          return {
            team_member_id: memberId,
            name: tm?.full_name ?? "—",
            audits_count: auditsByMemberRanking.get(memberId) ?? 0,
            answered: v.answered,
            fails: v.fails,
            fail_rate_pct: failRate,
            last_audit_at: lastByMember.get(memberId) ?? null,
          };
        });

        // -------------------------
        // B) Fallos comunes (sobre runsAll)
        // -------------------------
        const standardAgg = new Map<string, { fail_count: number; members: Set<string> }>();

        for (const a of answersLite) {
          const memberId = memberByRun.get(a.audit_run_id);
          if (!memberId) continue;

          const val = (a.result ?? a.answer) as "PASS" | "FAIL" | "NA" | null;
          if (val !== "FAIL") continue;

          const q = qById.get(a.question_id);
          if (!q) continue;

          const cur = standardAgg.get(q.id) ?? { fail_count: 0, members: new Set<string>() };
          cur.fail_count += 1;
          cur.members.add(memberId);
          standardAgg.set(q.id, cur);
        }

        const listAll: CommonStandardRow[] = Array.from(standardAgg.entries()).map(([question_id, v]) => {
          const q = qById.get(question_id);
          return {
            question_id,
            standard: q?.text ?? "—",
            tag: q?.tag ?? null,
            classification: q?.classification ?? null,
            affected_members: v.members.size,
            fail_count: v.fail_count,
          };
        });

        const byPeople = [...listAll]
          .filter((x) => x.affected_members > 1)
          .sort((a, b) => {
            if (b.affected_members !== a.affected_members) return b.affected_members - a.affected_members;
            return b.fail_count - a.fail_count;
          })
          .slice(0, 30);

        const byFails = [...listAll]
          .sort((a, b) => {
            if (b.fail_count !== a.fail_count) return b.fail_count - a.fail_count;
            return b.affected_members - a.affected_members;
          })
          .slice(0, 30);

        if (!alive) return;
        setTemplates(templateList);
        setMembersForArea(membersSorted);
        setRankingRaw(rankingList);
        setCommonByPeople(byPeople);
        setCommonByFails(byFails);
        setBusy(false);
      } catch (e: any) {
        if (!alive) return;
        setBusy(false);
        setError(e?.message ?? "No se pudo calcular la analítica.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [hotelId, selectedAreaId, fromISO, toISO, rankingMode, onFirstMemberAutoSelect]);

  return {
    busy,
    error,
    templates,
    membersForArea,
    ranking,
    commonByPeople,
    commonByFails,
    sortKey,
    sortDir,
    toggleSort,
  };
}