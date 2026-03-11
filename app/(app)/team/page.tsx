"use client";

import Card from "@/components/ui/Card";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";

import { useTeamData, type TeamPeriodKey } from "./_hooks/useTeamData";
import TeamTargetAssignmentsCard from "./_components/TeamTargetAssignmentsCard";
import CorrectiveActionsPanel from "./_components/CorrectiveActionsPanel";
import ReauditsPanel from "./_components/ReauditsPanel";
import ManagerAreaWorkspace, {
  type ManagerAreaHistoryFilters,
  type ManagerAreaOption,
} from "./_components/ManagerAreaWorkspace";

function buildBtnStyle(): CSSProperties {
  return {
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "9px 11px",
    background: "var(--card-bg)",
    color: "rgba(15,23,42,0.82)",
    cursor: "pointer",
    transition: "background 140ms ease, border-color 140ms ease, color 140ms ease, box-shadow 140ms ease",
  };
}

function buildInputStyle(): CSSProperties {
  return {
    width: "100%",
    padding: "9px 11px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.18)",
    color: "white",
    outline: "none",
  };
}

function getPeriodLabel(period: TeamPeriodKey) {
  if (period === "daily") return "hoy";
  if (period === "weekly") return "esta semana";
  return "este mes";
}

function formatPct(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `${x.toFixed(0)}%`;
}

const HOTEL_KEY = "sc_hotel_id";

type TeamTabKey = "summary" | "actions" | "reaudits" | "area" | "history" | "templates";

export default function TeamPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  requireRoleOrRedirect(
    ["superadmin", "admin", "manager", "quality", "engineering", "systems"],
    router
  );

  const btn = useMemo(() => buildBtnStyle(), []);
  const input = useMemo(() => buildInputStyle(), []);

  const [selectedPeriod, setSelectedPeriod] = useState<TeamPeriodKey>("monthly");
  const [showAssignmentsConfig, setShowAssignmentsConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<TeamTabKey>("area");
  const [hoveredTab, setHoveredTab] = useState<TeamTabKey | null>(null);
  const [managerAreasLoading, setManagerAreasLoading] = useState(false);
  const [managerAreasError, setManagerAreasError] = useState<string | null>(null);
  const [managerAreaOptions, setManagerAreaOptions] = useState<ManagerAreaOption[]>([]);
  const [selectedManagerAreaId, setSelectedManagerAreaId] = useState("");
  const [managerAreaHistoryFilters, setManagerAreaHistoryFilters] =
    useState<ManagerAreaHistoryFilters>(null);

  const { loading, error, profile, leaderboard, teamTargets, teamRecentRuns, summary } =
    useTeamData(selectedPeriod);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (!requestedTab) return;

    const allowedTabs: TeamTabKey[] = [
      "summary",
      "actions",
      "reaudits",
      "area",
      "history",
      "templates",
    ];

    if (!allowedTabs.includes(requestedTab as TeamTabKey)) return;

    if (profile?.role === "manager") {
      setActiveTab(requestedTab as TeamTabKey);
      return;
    }

    if (requestedTab === "summary" || requestedTab === "actions" || requestedTab === "reaudits") {
      setActiveTab(requestedTab);
    }
  }, [profile?.role, searchParams]);

  useEffect(() => {
    if (profile?.role === "engineering" || profile?.role === "systems") {
      setActiveTab("actions");
      return;
    }

    if (profile?.role === "manager") {
      setActiveTab((prev) => {
        if (
          prev === "summary" ||
          prev === "actions" ||
          prev === "reaudits" ||
          prev === "area" ||
          prev === "history" ||
          prev === "templates"
        ) {
          return prev;
        }
        return "area";
      });
      return;
    }

    setActiveTab((prev) => {
      if (prev === "summary" || prev === "actions" || prev === "reaudits") {
        return prev;
      }
      return "summary";
    });
  }, [profile?.role]);

  useEffect(() => {
    let cancelled = false;

    async function loadManagerAreas() {
      if (profile?.role !== "manager") {
        setManagerAreaOptions([]);
        setSelectedManagerAreaId("");
        setManagerAreasError(null);
        setManagerAreasLoading(false);
        return;
      }

      try {
        setManagerAreasLoading(true);
        setManagerAreasError(null);

        const hotelIdToUse =
          profile.hotel_id ??
          (typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null) ??
          "";

        const { data: accessData, error: accessError } = await supabase
          .from("user_area_access")
          .select("area_id")
          .eq("user_id", profile.id)
          .eq("hotel_id", hotelIdToUse);

        if (accessError) throw accessError;

        const areaIds = Array.from(
          new Set((accessData ?? []).map((row: { area_id: string | null }) => row.area_id).filter(Boolean))
        ) as string[];

        if (areaIds.length === 0) {
          if (cancelled) return;
          setManagerAreaOptions([]);
          setSelectedManagerAreaId("");
          setManagerAreasLoading(false);
          return;
        }

        const { data: areaData, error: areaError } = await supabase
          .from("areas")
          .select("id,name,type")
          .in("id", areaIds)
          .order("name", { ascending: true });

        if (areaError) throw areaError;

        const options = (areaData ?? []) as ManagerAreaOption[];
        if (cancelled) return;

        setManagerAreaOptions(options);
        setSelectedManagerAreaId((prev) =>
          prev && options.some((area) => area.id === prev) ? prev : options[0]?.id ?? ""
        );
      } catch (error: any) {
        if (cancelled) return;
        setManagerAreasError(error?.message ?? "No se pudieron cargar las áreas asignadas.");
      } finally {
        if (!cancelled) setManagerAreasLoading(false);
      }
    }

    void loadManagerAreas();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const panelBodyStyle: CSSProperties = {
    marginTop: 10,
    display: "grid",
    gap: 10,
    maxHeight: 620,
    overflowY: "auto",
    paddingRight: 4,
    alignContent: "start",
  };

  const progressTrackStyle: CSSProperties = {
    marginTop: 10,
    height: 5,
    borderRadius: 999,
    background: "rgba(15,23,42,0.08)",
    overflow: "hidden",
  };

  const groupedTargetsByAuditor = useMemo(() => {
    const map: Record<
      string,
      {
        auditor: string;
        auditorUserId: string;
        rows: typeof teamTargets;
        targetSum: number;
        completedSum: number;
        remainingSum: number;
        progressPct: number;
      }
    > = {};

    for (const row of teamTargets) {
      const key = row.auditor_user_id;
      if (!map[key]) {
        map[key] = {
          auditor: row.auditor ?? "—",
          auditorUserId: row.auditor_user_id,
          rows: [],
          targetSum: 0,
          completedSum: 0,
          remainingSum: 0,
          progressPct: 0,
        };
      }

      map[key].rows.push(row);
      map[key].targetSum += Number(row.target ?? 0);
      map[key].completedSum += Number(row.completed ?? 0);
      map[key].remainingSum += Number(row.remaining ?? 0);
    }

    const result = Object.values(map).map((group) => {
      group.rows.sort((a, b) => {
        const remDiff = Number(b.remaining ?? 0) - Number(a.remaining ?? 0);
        if (remDiff !== 0) return remDiff;
        return String(a.template ?? "").localeCompare(String(b.template ?? ""));
      });

      group.progressPct =
        group.targetSum > 0 ? (group.completedSum / group.targetSum) * 100 : 0;

      return group;
    });

    result.sort((a, b) => {
      const remDiff = b.remainingSum - a.remainingSum;
      if (remDiff !== 0) return remDiff;

      const pctDiff = a.progressPct - b.progressPct;
      if (pctDiff !== 0) return pctDiff;

      return a.auditor.localeCompare(b.auditor);
    });

    return result;
  }, [teamTargets]);

  const insights = useMemo(() => {
    const list: {
      type: "warning" | "info";
      title: string;
      text: string;
    }[] = [];

    if (summary.totalTargets > 0 && summary.totalAuditsDone === 0) {
      list.push({
        type: "warning",
        title: "Atención",
        text: "El equipo aún no ha iniciado el objetivo del periodo.",
      });
    } else if (summary.totalTargets > 0) {
      const ratio = summary.totalRemaining / summary.totalTargets;

      if (ratio > 0.7) {
        list.push({
          type: "warning",
          title: "Retraso en objetivos",
          text: "Queda más del 70% del objetivo del periodo por completar.",
        });
      }
    }

    if (groupedTargetsByAuditor.length > 0) {
      const top = groupedTargetsByAuditor[0];

      if (top.remainingSum > 0) {
        list.push({
          type: "info",
          title: "Reparto de carga",
          text: `${top.auditor} concentra la mayor carga pendiente (${top.remainingSum} auditorías).`,
        });
      }
    }

    return list.slice(0, 3);
  }, [summary, groupedTargetsByAuditor]);

  const hotelId =
    typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) ?? "" : "";

  const showSummaryTab =
    profile?.role === "superadmin" ||
    profile?.role === "admin" ||
    profile?.role === "manager" ||
    profile?.role === "quality";

  const showReauditsTab =
    profile?.role === "superadmin" ||
    profile?.role === "admin" ||
    profile?.role === "manager" ||
    profile?.role === "quality";

  const showManagerAreaTabs = profile?.role === "manager";
  const activeManagerArea =
    showManagerAreaTabs && selectedManagerAreaId
      ? managerAreaOptions.find((area) => area.id === selectedManagerAreaId) ?? null
      : null;
  const showManagerAreaLabel =
    Boolean(activeManagerArea) &&
    (activeTab === "area" || activeTab === "history" || activeTab === "templates");

  const tabStyle = (tabKey: TeamTabKey, isActive: boolean): CSSProperties => ({
    ...btn,
    background: isActive ? "#dbeafe" : hoveredTab === tabKey ? "#f3f4f6" : "var(--card-bg)",
    color: isActive ? "#1e3a8a" : "rgba(15,23,42,0.82)",
    border: isActive ? "1px solid #bfdbfe" : "1px solid var(--border)",
    boxShadow: isActive ? "0 0 0 1px rgba(59,130,246,0.08)" : "none",
    fontWeight: isActive ? 800 : 600,
  });

  return (
    <div style={{ padding: "12px 14px 18px", width: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>Equipo</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            Hola, <b>{profile?.full_name ?? "—"}</b> · Rol: <b>{profile?.role ?? "—"}</b>
          </div>
          {showManagerAreaLabel ? (
            <div style={{ opacity: 0.78, marginTop: 4, fontSize: 13, fontWeight: 700 }}>
              {activeManagerArea?.name ?? "—"}
              {activeManagerArea?.type ? ` · ${activeManagerArea.type}` : ""}
            </div>
          ) : null}
          <div style={{ opacity: 0.65, marginTop: 4, fontSize: 12 }}>
            Panel operativo del equipo, acciones correctivas y seguimiento de objetivos.
          </div>
        </div>

        {showSummaryTab && activeTab === "summary" ? (
          <div style={{ minWidth: 180, flex: "1 1 180px", maxWidth: 240 }}>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Periodo global</div>
            <select
              style={input}
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as TeamPeriodKey)}
            >
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {showManagerAreaTabs ? (
          <button
            style={tabStyle("area", activeTab === "area")}
            onClick={() => setActiveTab("area")}
            onMouseEnter={() => setHoveredTab("area")}
            onMouseLeave={() => setHoveredTab((prev) => (prev === "area" ? null : prev))}
          >
            General
          </button>
        ) : null}

        {showSummaryTab ? (
          <button
            style={tabStyle("summary", activeTab === "summary")}
            onClick={() => setActiveTab("summary")}
            onMouseEnter={() => setHoveredTab("summary")}
            onMouseLeave={() => setHoveredTab((prev) => (prev === "summary" ? null : prev))}
          >
            Follow up
          </button>
        ) : null}

        {showReauditsTab ? (
          <button
            style={tabStyle("reaudits", activeTab === "reaudits")}
            onClick={() => setActiveTab("reaudits")}
            onMouseEnter={() => setHoveredTab("reaudits")}
            onMouseLeave={() => setHoveredTab((prev) => (prev === "reaudits" ? null : prev))}
          >
            Recuperación
          </button>
        ) : null}

        {showManagerAreaTabs ? (
          <button
            style={tabStyle("history", activeTab === "history")}
            onClick={() => setActiveTab("history")}
            onMouseEnter={() => setHoveredTab("history")}
            onMouseLeave={() => setHoveredTab((prev) => (prev === "history" ? null : prev))}
          >
            Historial
          </button>
        ) : null}

        <button
          style={tabStyle("actions", activeTab === "actions")}
          onClick={() => setActiveTab("actions")}
          onMouseEnter={() => setHoveredTab("actions")}
          onMouseLeave={() => setHoveredTab((prev) => (prev === "actions" ? null : prev))}
        >
          Corrective actions
        </button>
      </div>

      {error && activeTab === "summary" ? (
        <Card style={{ marginTop: 14, border: "1px solid rgba(255,0,0,0.25)" }}>
          <b>Error:</b> {error}
        </Card>
      ) : null}

      {activeTab === "actions" ? (
        <div style={{ marginTop: 12 }}>
          <CorrectiveActionsPanel profile={profile} hotelId={hotelId} />
        </div>
      ) : null}

      {activeTab === "reaudits" && showReauditsTab ? (
        <div style={{ marginTop: 12 }}>
          <ReauditsPanel profile={profile} hotelId={hotelId} />
        </div>
      ) : null}

      {activeTab === "area" && showManagerAreaTabs ? (
        <div style={{ marginTop: 12 }}>
          <ManagerAreaWorkspace
            mode="dashboard"
            profileRole={profile?.role}
            areasLoading={managerAreasLoading}
            areasError={managerAreasError}
            areaOptions={managerAreaOptions}
            selectedAreaId={selectedManagerAreaId}
            onSelectArea={(areaId) => {
              setSelectedManagerAreaId(areaId);
              setManagerAreaHistoryFilters(null);
            }}
            historyFilters={managerAreaHistoryFilters}
            onOpenHistory={(filters) => {
              setManagerAreaHistoryFilters(filters);
              setActiveTab("history");
            }}
          />
        </div>
      ) : null}

      {activeTab === "history" && showManagerAreaTabs ? (
        <div style={{ marginTop: 12 }}>
          <ManagerAreaWorkspace
            mode="history"
            profileRole={profile?.role}
            areasLoading={managerAreasLoading}
            areasError={managerAreasError}
            areaOptions={managerAreaOptions}
            selectedAreaId={selectedManagerAreaId}
            onSelectArea={(areaId) => {
              setSelectedManagerAreaId(areaId);
              setManagerAreaHistoryFilters(null);
            }}
            historyFilters={managerAreaHistoryFilters}
            onOpenHistory={(filters) => setManagerAreaHistoryFilters(filters)}
          />
        </div>
      ) : null}

      {activeTab === "templates" && showManagerAreaTabs ? (
        <div style={{ marginTop: 12 }}>
          <ManagerAreaWorkspace
            mode="templates"
            profileRole={profile?.role}
            areasLoading={managerAreasLoading}
            areasError={managerAreasError}
            areaOptions={managerAreaOptions}
            selectedAreaId={selectedManagerAreaId}
            onSelectArea={(areaId) => {
              setSelectedManagerAreaId(areaId);
              setManagerAreaHistoryFilters(null);
            }}
            historyFilters={managerAreaHistoryFilters}
            onOpenHistory={(filters) => setManagerAreaHistoryFilters(filters)}
          />
        </div>
      ) : null}

      {activeTab === "summary" && showSummaryTab ? (
        <>
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            <Card>
              <div style={{ opacity: 0.8, fontSize: 13 }}>
                Auditorías equipo · {getPeriodLabel(selectedPeriod)}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>
                {summary.totalAuditsDone}
              </div>
            </Card>

            <Card>
              <div style={{ opacity: 0.8, fontSize: 13 }}>
                Objetivo total · {getPeriodLabel(selectedPeriod)}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>
                {summary.totalCompletedTargets} / {summary.totalTargets}
              </div>
            </Card>

            <Card>
              <div style={{ opacity: 0.8, fontSize: 13 }}>
                Restantes · {getPeriodLabel(selectedPeriod)}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>
                {summary.totalRemaining}
              </div>
            </Card>

            <Card>
              <div style={{ opacity: 0.8, fontSize: 13 }}>Progreso global</div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>
                {formatPct(summary.globalPct)}
              </div>
            </Card>
          </div>

          {insights.length > 0 && (
            <Card style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Insights del sistema</div>

              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gap: 10,
                }}
              >
                {insights.map((insight, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 12,
                      background:
                        insight.type === "warning"
                          ? "rgba(255,180,0,0.08)"
                          : "var(--card-bg)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        marginBottom: 4,
                      }}
                    >
                      {insight.type === "warning" ? "⚠ " : "ℹ "}
                      {insight.title}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        opacity: 0.9,
                      }}
                    >
                      {insight.text}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 12,
            }}
          >
            <Card>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                Leaderboard auditores (
                {selectedPeriod === "daily"
                  ? "hoy"
                  : selectedPeriod === "weekly"
                    ? "semana"
                    : "mes"}
                )
              </div>
              <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
                Resumen por persona, ordenado por % de objetivo completado.
              </div>

              <div style={panelBodyStyle}>
                {loading ? (
                  <div>Cargando…</div>
                ) : leaderboard.length === 0 ? (
                  <div style={{ opacity: 0.85 }}>No hay datos para este periodo.</div>
                ) : (
                  leaderboard.map((row, idx) => (
                    <Card key={row.auditor_user_id} padding={12}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 18,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            #{idx + 1} · {row.auditor_name}
                          </div>
                          <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                            Auditorías: <b>{row.audits_done}</b> · Media:{" "}
                            <b>
                              {row.avg_score !== null
                                ? `${Number(row.avg_score).toFixed(1)}%`
                                : "—"}
                            </b>
                          </div>
                          <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                            Objetivo: <b>{row.targets_completed}</b> / {row.targets_total}
                          </div>
                        </div>

                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 800, fontSize: 20 }}>
                            {formatPct(row.progress_pct)}
                          </div>
                        </div>
                      </div>

                      <div style={progressTrackStyle}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.max(
                              0,
                              Math.min(100, Number(row.progress_pct ?? 0))
                            )}%`,
                            borderRadius: 999,
                            background: "linear-gradient(90deg,#60a5fa,#38bdf8)",
                          }}
                        />
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Objetivos por auditor</div>
              <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
                Resumen por persona y detalle por auditoría para cerrar{" "}
                {getPeriodLabel(selectedPeriod)}.
              </div>

              <div style={panelBodyStyle}>
                {loading ? (
                  <div>Cargando…</div>
                ) : groupedTargetsByAuditor.length === 0 ? (
                  <div style={{ opacity: 0.85 }}>No hay objetivos para este periodo.</div>
                ) : (
                  groupedTargetsByAuditor.map((group) => (
                    <Card key={group.auditorUserId} padding={12}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 18,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {group.auditor}
                          </div>
                          <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                            Restan <b>{group.remainingSum}</b> · {group.completedSum}/
                            {group.targetSum}
                          </div>
                        </div>

                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 800, fontSize: 20 }}>
                            {formatPct(group.progressPct)}
                          </div>
                        </div>
                      </div>

                      <div style={progressTrackStyle}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.max(
                              0,
                              Math.min(100, Number(group.progressPct ?? 0))
                            )}%`,
                            borderRadius: 999,
                            background: "linear-gradient(90deg,#60a5fa,#38bdf8)",
                          }}
                        />
                      </div>

                      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                        {group.rows.map((row) => (
                          <Card
                            key={row.target_id}
                            padding={10}
                            radius={12}
                            shadow="none"
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                minWidth: 0,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                opacity: 0.95,
                              }}
                            >
                              {row.template}
                            </div>

                            <div
                              style={{
                                textAlign: "right",
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>
                                {row.completed} / {row.target}
                              </div>
                              <div style={{ opacity: 0.8, fontSize: 12 }}>
                                faltan <b>{row.remaining}</b>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Actividad reciente del equipo</div>
              <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
                Últimas auditorías ejecutadas en {getPeriodLabel(selectedPeriod)} por tu equipo.
              </div>

              <div style={panelBodyStyle}>
                {loading ? (
                  <div>Cargando…</div>
                ) : teamRecentRuns.length === 0 ? (
                  <div style={{ opacity: 0.85 }}>
                    Aún no hay auditorías recientes del equipo.
                  </div>
                ) : (
                  teamRecentRuns.map((run) => (
                    <Card key={run.id} padding={12}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {run.auditor_name ?? "—"}
                          </div>
                          <div
                            style={{
                              opacity: 0.85,
                              fontSize: 13,
                              marginTop: 4,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {run.template_name ?? "Auditoría"}
                          </div>
                        </div>

                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 700 }}>
                            {run.score !== null && run.score !== undefined
                              ? `${Number(run.score).toFixed(1)}%`
                              : "—"}
                          </div>
                          <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                            {run.executed_at
                              ? run.executed_at.replace("T", " ").slice(0, 16)
                              : "—"}
                          </div>
                          </div>
                        </div>
                    </Card>
                  ))
                )}
              </div>
            </Card>
          </div>

          <Card style={{ marginTop: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  Configuración de objetivos
                </div>
                <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
                  Ajusta el reparto por auditoría solo cuando necesites revisar o modificar la
                  asignación.
                </div>
              </div>

              <button
                style={btn}
                onClick={() => setShowAssignmentsConfig((prev) => !prev)}
              >
                {showAssignmentsConfig ? "Ocultar configuración" : "Mostrar configuración"}
              </button>
            </div>

            {showAssignmentsConfig ? (
              <div style={{ marginTop: 14 }}>
                <TeamTargetAssignmentsCard
                  card={{
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: 14,
                    background: "var(--card-bg)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                  hotelId={hotelId}
                />
              </div>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}
