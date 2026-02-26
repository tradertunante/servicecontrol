// FILE: app/(app)/team/analytics/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/app/components/BackButton";
import { supabase } from "@/lib/supabaseClient";

type Role = "admin" | "manager" | "auditor" | "superadmin";

type Profile = {
  id: string;
  hotel_id: string | null;
  role: Role;
  active: boolean | null;
  full_name?: string | null;
};

type HotelRow = { id: string; name: string };

type AreaRow = {
  id: string;
  name: string;
  type: string | null;
  hotel_id: string | null;
};

type AuditRunRow = {
  id: string;
  executed_at: string | null;
  team_member_id: string | null;
  area_id: string;
  status: string | null;
  hotel_id: string | null;
};

type AnswerRowLite = {
  audit_run_id: string;
  question_id: string;
  answer: "PASS" | "FAIL" | "NA" | null;
  result: "PASS" | "FAIL" | "NA" | null;
};

type QuestionLite = {
  id: string;
  text: string;
  tag: string | null;
  classification: string | null;
};

type TeamMemberLite = {
  id: string;
  full_name: string;
  position: string | null;
  employee_number: string | null;
};

const HOTEL_KEY = "sc_hotel_id";

function canSeeAnalytics(role: Role) {
  // ✅ permitimos manager, pero luego filtramos áreas por permisos
  return role === "admin" || role === "manager" || role === "superadmin";
}

function isAdminLike(role: Role) {
  // ✅ SOLO admin + superadmin ven todas las áreas
  return role === "admin" || role === "superadmin";
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function safeVal(v: any): "PASS" | "FAIL" | "NA" | null {
  if (v === "PASS" || v === "FAIL" || v === "NA") return v;
  return null;
}

function topicKey(q: QuestionLite) {
  const t = (q.tag ?? "").trim();
  const c = (q.classification ?? "").trim();
  if (t) return `TAG:${t.toLowerCase()}`;
  if (c) return `CLASS:${c.toLowerCase()}`;
  return `Q:${q.id}`;
}

export default function TeamAnalyticsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [hotel, setHotel] = useState<HotelRow | null>(null);

  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

  const [period, setPeriod] = useState<"30" | "60" | "90" | "365" | "custom">("30");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const [tab, setTab] = useState<"ranking" | "common" | "similar">("ranking");

  const [ranking, setRanking] = useState<
    Array<{
      team_member_id: string;
      name: string;
      position: string | null;
      employee_number: string | null;
      answered: number;
      fails: number;
      fail_rate_pct: number | null;
      last_audit_at: string | null;
    }>
  >([]);

  const [commonFailures, setCommonFailures] = useState<
    Array<{
      topic: string;
      fail_count: number;
      affected_members: number;
      examples?: string;
    }>
  >([]);

  const [pairs, setPairs] = useState<
    Array<{
      a_id: string;
      a_name: string;
      b_id: string;
      b_name: string;
      shared_count: number;
    }>
  >([]);

  const selectedArea = useMemo(() => areas.find((a) => a.id === selectedAreaId) ?? null, [areas, selectedAreaId]);

  const fromISO = useMemo(() => {
    if (period === "30") return isoDaysAgo(30);
    if (period === "60") return isoDaysAgo(60);
    if (period === "90") return isoDaysAgo(90);
    if (period === "365") return isoDaysAgo(365);
    if (period === "custom") {
      if (!customFrom) return isoDaysAgo(30);
      const d = new Date(customFrom + "T00:00:00");
      return d.toISOString();
    }
    return isoDaysAgo(30);
  }, [period, customFrom]);

  const toISO = useMemo(() => {
    if (period !== "custom") return new Date().toISOString();
    if (!customTo) return new Date().toISOString();
    const d = new Date(customTo + "T23:59:59");
    return d.toISOString();
  }, [period, customTo]);

  const periodLabel = useMemo(() => {
    if (period === "30") return "Últimos 30 días";
    if (period === "60") return "Últimos 60 días";
    if (period === "90") return "Últimos 90 días";
    if (period === "365") return "Últimos 12 meses";
    return "Personalizado";
  }, [period]);

  // ----------------------------
  // Boot: auth + hotel + AREAS (con permisos)
  // ----------------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
          router.push("/login");
          return;
        }

        const { data: pData, error: pErr } = await supabase
          .from("profiles")
          .select("id,hotel_id,role,active,full_name")
          .eq("id", user.id)
          .single();

        if (pErr || !pData || pData.active === false) {
          router.push("/login");
          return;
        }

        const p = pData as Profile;

        if (!canSeeAnalytics(p.role)) {
          router.push("/dashboard");
          return;
        }

        const hid =
          p.role === "superadmin"
            ? (typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null) || null
            : p.hotel_id ?? null;

        if (!alive) return;
        setProfile(p);
        setHotelId(hid);

        if (!hid) {
          setLoading(false);
          setError("No hay hotel activo. Como superadmin, primero selecciona un hotel.");
          return;
        }

        const { data: hData, error: hErr } = await supabase.from("hotels").select("id,name").eq("id", hid).single();
        if (hErr) throw hErr;

        // ✅ AREAS: admin/superadmin todas, manager solo sus áreas (user_area_access)
        let areaRows: AreaRow[] = [];

        if (isAdminLike(p.role)) {
          const { data: aData, error: aErr } = await supabase
            .from("areas")
            .select("id,name,type,hotel_id")
            .eq("hotel_id", hid)
            .order("name", { ascending: true });

          if (aErr) throw aErr;
          areaRows = (aData ?? []) as AreaRow[];
        } else {
          // manager (y si luego quieres auditor) => solo áreas permitidas
          const { data: accessData, error: accessErr } = await supabase
            .from("user_area_access")
            .select("area_id")
            .eq("user_id", p.id)
            .eq("hotel_id", hid);

          if (accessErr) throw accessErr;

          const allowedIds = (accessData ?? []).map((r: any) => r.area_id).filter(Boolean);

          if (allowedIds.length > 0) {
            const { data: aData, error: aErr } = await supabase
              .from("areas")
              .select("id,name,type,hotel_id")
              .eq("hotel_id", hid)
              .in("id", allowedIds)
              .order("name", { ascending: true });

            if (aErr) throw aErr;
            areaRows = (aData ?? []) as AreaRow[];
          } else {
            areaRows = [];
          }
        }

        if (!alive) return;
        setHotel((hData as any) ?? null);
        setAreas(areaRows);

        // ✅ seleccion por defecto: primera de sus áreas permitidas
        if (areaRows.length > 0) {
          setSelectedAreaId(areaRows[0].id);
        } else {
          setSelectedAreaId("");
          setError("No tienes áreas asignadas para ver analítica. Revisa user_area_access.");
        }

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setLoading(false);
        setError(e?.message ?? "Error cargando analítica.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  // ----------------------------
  // Load analytics whenever filters change
  // ----------------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!hotelId) return;
      if (!selectedAreaId) return;

      setBusy(true);
      setError(null);

      try {
        // 1) Runs del área en el periodo, submitted, con colaborador
        const { data: runsData, error: runsErr } = await supabase
          .from("audit_runs")
          .select("id,executed_at,team_member_id,area_id,status,hotel_id")
          .eq("hotel_id", hotelId)
          .eq("area_id", selectedAreaId)
          .eq("status", "submitted")
          .not("team_member_id", "is", null)
          .gte("executed_at", fromISO)
          .lte("executed_at", toISO)
          .order("executed_at", { ascending: false });

        if (runsErr) throw runsErr;

        const runs = (runsData ?? []) as AuditRunRow[];
        const runIds = runs.map((r) => r.id);

        if (runIds.length === 0) {
          if (!alive) return;
          setRanking([]);
          setCommonFailures([]);
          setPairs([]);
          setBusy(false);
          return;
        }

        // 2) Answers de esas runs
        const { data: ansData, error: ansErr } = await supabase
          .from("audit_answers")
          .select("audit_run_id,question_id,answer,result")
          .in("audit_run_id", runIds);

        if (ansErr) throw ansErr;

        const answersLite: AnswerRowLite[] = (ansData ?? []).map((a: any) => ({
          audit_run_id: a.audit_run_id,
          question_id: a.question_id,
          answer: safeVal(a.answer),
          result: safeVal(a.result),
        }));

        // 3) Preguntas (tag/classification)
        const qIds = Array.from(new Set(answersLite.map((a) => a.question_id).filter(Boolean)));
        const { data: qData, error: qErr } = await supabase
          .from("audit_questions")
          .select("id,text,tag,classification")
          .in("id", qIds);

        if (qErr) throw qErr;

        const qById = new Map<string, QuestionLite>();
        (qData ?? []).forEach((q: any) => qById.set(q.id, q as QuestionLite));

        // 4) Team members (nombres)
        const memberIds = Array.from(new Set(runs.map((r) => r.team_member_id).filter(Boolean))) as string[];
        const { data: tmData, error: tmErr } = await supabase
          .from("team_members")
          .select("id,full_name,position,employee_number")
          .in("id", memberIds);

        if (tmErr) throw tmErr;

        const tmById = new Map<string, TeamMemberLite>();
        (tmData ?? []).forEach((tm: any) => tmById.set(tm.id, tm as TeamMemberLite));

        // Map runId -> memberId
        const memberByRun = new Map<string, string>();
        for (const r of runs) {
          if (r.team_member_id) memberByRun.set(r.id, r.team_member_id);
        }

        // A) Ranking
        const agg = new Map<string, { answered: number; fails: number }>();
        for (const a of answersLite) {
          const memberId = memberByRun.get(a.audit_run_id);
          if (!memberId) continue;

          const val = (a.result ?? a.answer) as "PASS" | "FAIL" | "NA" | null;
          if (val !== "PASS" && val !== "FAIL" && val !== "NA") continue;

          const cur = agg.get(memberId) ?? { answered: 0, fails: 0 };
          if (val === "PASS" || val === "FAIL") cur.answered += 1;
          if (val === "FAIL") cur.fails += 1;
          agg.set(memberId, cur);
        }

        const lastByMember = new Map<string, string>();
        for (const r of runs) {
          if (!r.team_member_id || !r.executed_at) continue;
          const prev = lastByMember.get(r.team_member_id);
          if (!prev || new Date(r.executed_at).getTime() > new Date(prev).getTime()) {
            lastByMember.set(r.team_member_id, r.executed_at);
          }
        }

        const rankingList = Array.from(agg.entries()).map(([memberId, v]) => {
          const tm = tmById.get(memberId);
          const denom = v.answered;
          const failRate = denom === 0 ? null : Math.round((v.fails / denom) * 100 * 100) / 100;

          return {
            team_member_id: memberId,
            name: tm?.full_name ?? "—",
            position: tm?.position ?? null,
            employee_number: tm?.employee_number ?? null,
            answered: v.answered,
            fails: v.fails,
            fail_rate_pct: failRate,
            last_audit_at: lastByMember.get(memberId) ?? null,
          };
        });

        rankingList.sort((a, b) => (b.fail_rate_pct ?? -1) - (a.fail_rate_pct ?? -1));

        // B) Fallos comunes por topic
        const topicAgg = new Map<string, { fail_count: number; members: Set<string>; exampleText?: string }>();

        for (const a of answersLite) {
          const memberId = memberByRun.get(a.audit_run_id);
          if (!memberId) continue;

          const val = (a.result ?? a.answer) as "PASS" | "FAIL" | "NA" | null;
          if (val !== "FAIL") continue;

          const q = qById.get(a.question_id);
          if (!q) continue;

          const key = topicKey(q);
          const cur = topicAgg.get(key) ?? { fail_count: 0, members: new Set<string>(), exampleText: q.text };
          cur.fail_count += 1;
          cur.members.add(memberId);
          if (!cur.exampleText) cur.exampleText = q.text;
          topicAgg.set(key, cur);
        }

        const commonList = Array.from(topicAgg.entries())
          .map(([key, v]) => ({
            topic: key.startsWith("TAG:") ? key.replace("TAG:", "") : key.startsWith("CLASS:") ? key.replace("CLASS:", "") : key,
            fail_count: v.fail_count,
            affected_members: v.members.size,
            examples: v.exampleText,
          }))
          .sort((a, b) => b.fail_count - a.fail_count)
          .slice(0, 30);

        // C) Parejas con fallos similares
        const topicsByMember = new Map<string, Set<string>>();
        for (const [k, v] of topicAgg.entries()) {
          for (const memberId of v.members) {
            const set = topicsByMember.get(memberId) ?? new Set<string>();
            set.add(k);
            topicsByMember.set(memberId, set);
          }
        }

        const ids = Array.from(topicsByMember.keys());
        const pairList: Array<{ a: string; b: string; shared: number }> = [];

        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const aId = ids[i];
            const bId = ids[j];
            const aSet = topicsByMember.get(aId) ?? new Set<string>();
            const bSet = topicsByMember.get(bId) ?? new Set<string>();

            let shared = 0;
            const [small, big] = aSet.size <= bSet.size ? [aSet, bSet] : [bSet, aSet];
            small.forEach((t) => {
              if (big.has(t)) shared += 1;
            });

            if (shared > 0) pairList.push({ a: aId, b: bId, shared });
          }
        }

        pairList.sort((x, y) => y.shared - x.shared);

        const pairsUi = pairList.slice(0, 25).map((p) => ({
          a_id: p.a,
          a_name: tmById.get(p.a)?.full_name ?? "—",
          b_id: p.b,
          b_name: tmById.get(p.b)?.full_name ?? "—",
          shared_count: p.shared,
        }));

        if (!alive) return;
        setRanking(rankingList);
        setCommonFailures(commonList);
        setPairs(pairsUi);
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
  }, [hotelId, selectedAreaId, fromISO, toISO]);

  if (loading) {
    return (
      <main className="w-full min-h-screen bg-gray-50 overflow-x-hidden">
        <div className="w-full px-4 pt-4 pb-24">
          <p className="text-sm font-semibold text-gray-600">Cargando…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="w-full px-4 pt-4 pb-24">
        <div className="mb-3">
          <BackButton fallback="/team" />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-gray-500">{hotel?.name ?? "Hotel"}</div>
            <h1 className="text-2xl font-extrabold tracking-tight">Analítica · Colaboradores</h1>
            <div className="mt-1 text-sm font-semibold text-gray-600">
              Ranking, fallos comunes y grupos de formación por área.
            </div>
          </div>

          <div className="flex items-center gap-2">
            {busy ? (
              <span className="rounded-full border bg-white px-3 py-1 text-xs font-extrabold text-gray-700">
                Calculando…
              </span>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {/* Filtros */}
        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold mb-3">Filtros</div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1.5">
              <label className="text-xs font-extrabold text-gray-500">Área</label>
              <select
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black"
                disabled={areas.length === 0}
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.type ? `${a.name} · ${a.type}` : a.name}
                  </option>
                ))}
              </select>
              {areas.length === 0 ? (
                <div className="text-xs font-semibold text-gray-500 mt-1">No tienes áreas asignadas.</div>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-extrabold text-gray-500">Periodo</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black"
              >
                <option value="30">Últimos 30 días</option>
                <option value="60">Últimos 60 días</option>
                <option value="90">Últimos 90 días</option>
                <option value="365">Últimos 12 meses</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-extrabold text-gray-500">Resumen</label>
              <div className="rounded-2xl border bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
                {selectedArea ? (selectedArea.type ? `${selectedArea.name} · ${selectedArea.type}` : selectedArea.name) : "—"} ·{" "}
                {periodLabel}
              </div>
            </div>
          </div>

          {period === "custom" ? (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-extrabold text-gray-500">Desde</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black"
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-extrabold text-gray-500">Hasta</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black"
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-extrabold text-gray-500">Tip</label>
                <div className="rounded-2xl border bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
                  Si dejas “Hasta” vacío, usa hoy.
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setTab("ranking")}
            className={[
              "rounded-2xl px-4 py-2.5 text-sm font-extrabold border",
              tab === "ranking" ? "bg-black text-white border-black" : "bg-white text-black border-gray-200 hover:bg-gray-50",
            ].join(" ")}
          >
            Ranking
          </button>

          <button
            onClick={() => setTab("common")}
            className={[
              "rounded-2xl px-4 py-2.5 text-sm font-extrabold border",
              tab === "common" ? "bg-black text-white border-black" : "bg-white text-black border-gray-200 hover:bg-gray-50",
            ].join(" ")}
          >
            Fallos comunes
          </button>

          <button
            onClick={() => setTab("similar")}
            className={[
              "rounded-2xl px-4 py-2.5 text-sm font-extrabold border",
              tab === "similar" ? "bg-black text-white border-black" : "bg-white text-black border-gray-200 hover:bg-gray-50",
            ].join(" ")}
          >
            Formación conjunta
          </button>
        </div>

        {/* Content */}
        {tab === "ranking" ? (
          <section className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold">Ranking por colaborador</div>
                <div className="mt-1 text-xs font-semibold text-gray-500">
                  Ordenado por % de fallos (peor → mejor). NA no cuenta.
                </div>
              </div>

              <div className="rounded-2xl border bg-gray-50 px-3 py-2 text-xs font-extrabold text-gray-700">
                {ranking.length} colaboradores
              </div>
            </div>

            {ranking.length === 0 ? (
              <div className="mt-4 text-sm font-semibold text-gray-600">
                No hay auditorías con colaborador en este periodo.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="text-left font-extrabold py-2 pr-3">Colaborador</th>
                      <th className="text-left font-extrabold py-2 pr-3">Posición</th>
                      <th className="text-left font-extrabold py-2 pr-3">Nº</th>
                      <th className="text-right font-extrabold py-2 pl-3">Respondidas</th>
                      <th className="text-right font-extrabold py-2 pl-3">FAIL</th>
                      <th className="text-right font-extrabold py-2 pl-3">% FAIL</th>
                      <th className="text-right font-extrabold py-2 pl-3">Última</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((r) => (
                      <tr key={r.team_member_id} className="border-t">
                        <td className="py-3 pr-3">
                          <div className="font-extrabold text-gray-900">{r.name}</div>
                        </td>
                        <td className="py-3 pr-3 font-semibold text-gray-700">{r.position ?? "—"}</td>
                        <td className="py-3 pr-3 font-semibold text-gray-700">{r.employee_number ?? "—"}</td>
                        <td className="py-3 pl-3 text-right font-semibold text-gray-800">{r.answered}</td>
                        <td className="py-3 pl-3 text-right font-extrabold text-gray-900">{r.fails}</td>
                        <td className="py-3 pl-3 text-right font-extrabold">
                          {r.fail_rate_pct === null ? (
                            <span className="text-gray-500">—</span>
                          ) : (
                            <span
                              className={[
                                "inline-flex rounded-full px-3 py-1 border",
                                r.fail_rate_pct >= 20
                                  ? "bg-red-50 border-red-200 text-red-700"
                                  : r.fail_rate_pct >= 10
                                  ? "bg-amber-50 border-amber-200 text-amber-700"
                                  : "bg-green-50 border-green-200 text-green-700",
                              ].join(" ")}
                            >
                              {r.fail_rate_pct.toFixed(2)}%
                            </span>
                          )}
                        </td>
                        <td className="py-3 pl-3 text-right text-xs font-semibold text-gray-600">
                          {r.last_audit_at ? new Date(r.last_audit_at).toLocaleDateString("es-ES") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {tab === "common" ? (
          <section className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold">Fallos más comunes</div>
                <div className="mt-1 text-xs font-semibold text-gray-500">
                  Agrupado por <span className="font-extrabold">Tag</span> o <span className="font-extrabold">Classification</span>.
                </div>
              </div>

              <div className="rounded-2xl border bg-gray-50 px-3 py-2 text-xs font-extrabold text-gray-700">
                Top {commonFailures.length}
              </div>
            </div>

            {commonFailures.length === 0 ? (
              <div className="mt-4 text-sm font-semibold text-gray-600">Sin fallos en este periodo.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {commonFailures.map((f, idx) => (
                  <div key={`${f.topic}-${idx}`} className="rounded-2xl border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div style={{ minWidth: 0 }}>
                        <div className="text-base font-extrabold text-gray-900 break-words">{f.topic}</div>
                        {f.examples ? (
                          <div className="mt-1 text-xs font-semibold text-gray-600 break-words">
                            Ejemplo: <span className="font-semibold">{f.examples}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="rounded-full border bg-gray-50 px-3 py-1 text-xs font-extrabold text-gray-800">
                          {f.fail_count} FAIL
                        </span>
                        <span className="rounded-full border bg-gray-50 px-3 py-1 text-xs font-extrabold text-gray-800">
                          {f.affected_members} personas
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {tab === "similar" ? (
          <section className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-extrabold">Formación conjunta</div>
            <div className="mt-1 text-xs font-semibold text-gray-500">
              Parejas con más coincidencias en fallos (por Tag/Classification).
            </div>

            {pairs.length === 0 ? (
              <div className="mt-4 text-sm font-semibold text-gray-600">No hay suficientes datos para comparar.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {pairs.map((p, idx) => (
                  <div key={`${p.a_id}-${p.b_id}-${idx}`} className="rounded-2xl border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div style={{ minWidth: 0 }}>
                        <div className="text-base font-extrabold text-gray-900 break-words">
                          {p.a_name} <span className="text-gray-400">·</span> {p.b_name}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-gray-600">
                          Coincidencias de fallos (topics) en el periodo.
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        <span className="rounded-full border bg-amber-50 border-amber-200 px-3 py-1 text-xs font-extrabold text-amber-800">
                          {p.shared_count} en común
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {profile ? (
          <div className="mt-6 text-xs font-semibold text-gray-500">
            Sesión: <span className="font-mono">{profile.id}</span> · Rol:{" "}
            <span className="font-extrabold">{profile.role}</span> · Hotel:{" "}
            <span className="font-mono">{hotelId ?? "null"}</span>
          </div>
        ) : null}
      </div>
    </main>
  );
}