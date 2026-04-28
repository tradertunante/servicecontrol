"use client";

import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import { useTranslations } from "next-intl";
import type { Profile } from "@/lib/types";
import TeamTargetAssignmentsCard from "./TeamTargetAssignmentsCard";
import { useTeamData, type TeamPeriodKey } from "../_hooks/useTeamData";
import type { ManagerAreaOption } from "./ManagerAreaWorkspace";

function formatPct(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `${x.toFixed(0)}%`;
}

export default function TeamSummaryTab({
  selectedPeriod,
  hotelId,
  initialProfile,
  selectedAreaId,
  areaOptions = [],
  onSelectArea,
}: {
  selectedPeriod: TeamPeriodKey;
  hotelId: string;
  initialProfile: Profile;
  selectedAreaId?: string | null;
  areaOptions?: ManagerAreaOption[];
  onSelectArea?: (id: string | null) => void;
}) {
  const t = useTranslations("app.team.summary");
  const [showAssignmentsConfig, setShowAssignmentsConfig] = useState(false);
  const { loading, error, leaderboard, teamTargets, teamRecentRuns, teamTemplateProgress, summary } =
    useTeamData({ selectedPeriod, initialHotelId: hotelId, initialProfile, selectedAreaId });

  const overviewSummary = useMemo(() => {
    let totalTargets = 0;
    let totalCoveredTargets = 0;
    let totalRemaining = 0;

    for (const row of teamTargets) {
      const target = Number(row.target ?? 0);
      const completed = Number(row.completed ?? 0);
      const covered = Math.min(completed, target);
      const remaining = Math.max(target - covered, 0);

      totalTargets += target;
      totalCoveredTargets += covered;
      totalRemaining += remaining;
    }

    const globalPct =
      totalTargets > 0 ? (totalCoveredTargets / totalTargets) * 100 : 0;

    return {
      totalAuditsDone: summary.totalAuditsDone,
      totalTargets,
      totalCoveredTargets,
      totalRemaining,
      globalPct,
    };
  }, [summary.totalAuditsDone, teamTargets]);

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

  const groupedTargetsByTemplateFallback = useMemo(() => {
    const map: Record<
      string,
      {
        template: string;
        targetSum: number;
        completedSum: number;
        remainingSum: number;
        progressPct: number;
      }
    > = {};

    for (const row of teamTargets) {
      const key = String(row.template ?? "Auditoría");
      const target = Number(row.target ?? 0);
      const completed = Number(row.completed ?? 0);
      const remaining = Math.max(target - completed, 0);

      if (!map[key]) {
        map[key] = {
          template: key,
          targetSum: 0,
          completedSum: 0,
          remainingSum: 0,
          progressPct: 0,
        };
      }

      map[key].targetSum += target;
      map[key].completedSum += completed;
      map[key].remainingSum += remaining;
    }

    const result = Object.values(map).map((group) => ({
      ...group,
      progressPct: group.targetSum > 0 ? (group.completedSum / group.targetSum) * 100 : 0,
    }));

    result.sort((a, b) => {
      const remainingDiff = b.remainingSum - a.remainingSum;
      if (remainingDiff !== 0) return remainingDiff;
      return a.template.localeCompare(b.template);
    });

    return result;
  }, [teamTargets]);

  const groupedTargetsByTemplate = useMemo(() => {
    if (teamTemplateProgress.length > 0) return teamTemplateProgress;
    return groupedTargetsByTemplateFallback;
  }, [groupedTargetsByTemplateFallback, teamTemplateProgress]);

  const rubricGoalProgress = useMemo(
    () =>
      groupedTargetsByTemplate.map((group) => {
        const template = String(group.template ?? "Auditoría");
        const target = Number(("targetSum" in group ? group.targetSum : group.target) ?? 0);
        const completed = Number(("completedSum" in group ? group.completedSum : group.completed) ?? 0);
        const remaining = Math.max(target - completed, 0);
        const progressPct = target > 0 ? Math.min((completed / target) * 100, 100) : 0;

        return {
          template,
          target,
          completed,
          remaining,
          progressPct,
        };
      }),
    [groupedTargetsByTemplate]
  );

  const rubricTargetsByAuditor = useMemo(() => {
    const auditorMap: Record<
      string,
      Array<{
        template: string;
        completed: number;
        target: number;
        remaining: number;
      }>
    > = {};

    const grouped: Record<
      string,
      Record<
        string,
        {
          template: string;
          completed: number;
          target: number;
          remaining: number;
        }
      >
    > = {};

    for (const row of teamTargets) {
      const auditorId = row.auditor_user_id;
      const template = String(row.template ?? "Auditoría");
      const target = Number(row.target ?? 0);
      const completed = Number(row.completed ?? 0);
      const remaining = Math.max(target - Math.min(completed, target), 0);

      if (!grouped[auditorId]) grouped[auditorId] = {};
      if (!grouped[auditorId][template]) {
        grouped[auditorId][template] = {
          template,
          completed: 0,
          target: 0,
          remaining: 0,
        };
      }

      grouped[auditorId][template].completed += completed;
      grouped[auditorId][template].target += target;
      grouped[auditorId][template].remaining += remaining;
    }

    for (const auditorId of Object.keys(grouped)) {
      auditorMap[auditorId] = Object.values(grouped[auditorId]).sort((a, b) => {
        const remainingDiff = b.remaining - a.remaining;
        if (remainingDiff !== 0) return remainingDiff;
        return a.template.localeCompare(b.template);
      });
    }

    return auditorMap;
  }, [teamTargets]);

  const insights = useMemo(() => {
    const list: {
      type: "warning" | "info";
      title: string;
      text: string;
    }[] = [];

    if (overviewSummary.totalTargets > 0 && overviewSummary.totalAuditsDone === 0) {
      list.push({
        type: "warning",
        title: t("insightWarningAttention"),
        text: t("insightNotStarted"),
      });
    } else if (overviewSummary.totalTargets > 0) {
      const ratio = overviewSummary.totalRemaining / overviewSummary.totalTargets;

      if (ratio > 0.7) {
        list.push({
          type: "warning",
          title: t("insightDelayTitle"),
          text: t("insightDelay"),
        });
      }
    }

    if (groupedTargetsByAuditor.length > 0) {
      const top = groupedTargetsByAuditor[0];
      const topPendingCount = groupedTargetsByAuditor.filter(
        (group) => group.remainingSum === top.remainingSum,
      ).length;

      if (top.remainingSum > 0) {
        list.push({
          type: "info",
          title: t("insightLoadTitle"),
          text:
            topPendingCount > 1
              ? t("insightLoadAmong", { name: top.auditor, count: top.remainingSum })
              : t("insightLoadTop", { name: top.auditor, count: top.remainingSum }),
        });
      }
    }

    return list.slice(0, 3);
  }, [overviewSummary, groupedTargetsByAuditor, t]);

  const progressTrackStyle: React.CSSProperties = {
    marginTop: 10,
    height: 5,
    borderRadius: 999,
    background: "rgba(15,23,42,0.08)",
    overflow: "hidden",
  };

  const panelBodyStyle: React.CSSProperties = {
    marginTop: 10,
    display: "grid",
    gap: 10,
    maxHeight: 620,
    overflowY: "auto",
    paddingRight: 10,
    alignContent: "start",
  };

  const btn: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "9px 11px",
    background: "var(--card-bg)",
    color: "rgba(15,23,42,0.82)",
    cursor: "pointer",
    transition: "background 140ms ease, border-color 140ms ease, color 140ms ease, box-shadow 140ms ease",
  };

  return (
    <>
      {error ? (
        <Card style={{ marginTop: 14, border: "1px solid rgba(255,0,0,0.25)" }}>
          <b>Error:</b> {error}
        </Card>
      ) : null}

      {areaOptions.length > 1 && (
        <Card style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7, marginBottom: 6 }}>
            {t("filterArea")}
          </div>
          <select
            value={selectedAreaId ?? ""}
            onChange={(e) => onSelectArea?.(e.target.value || null)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--card-bg)",
              color: "inherit",
              fontWeight: 700,
              fontSize: 14,
              outline: "none",
            }}
          >
            <option value="">{t("allAreas")}</option>
            {areaOptions.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}{area.type ? ` · ${area.type}` : ""}
              </option>
            ))}
          </select>
        </Card>
      )}

      {insights.length > 0 && (
        <Card style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{t("insightsTitle")}</div>

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
        data-onboarding="progress-grid"
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        <Card data-onboarding="progress-objectives">
          <div style={{ fontWeight: 700, fontSize: 16 }}>{t("objectivesTitle")}</div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
            {t("objectivesSubtitle", {
              period: selectedPeriod === "daily" ? t("periodToday") : selectedPeriod === "weekly" ? t("periodThisWeek") : t("periodThisMonth"),
            })}
          </div>

          <div style={panelBodyStyle}>
            {loading ? (
              <div>{t("loading")}</div>
            ) : rubricGoalProgress.length === 0 ? (
              <div style={{ opacity: 0.85 }}>{t("noObjectives")}</div>
            ) : (
              rubricGoalProgress.map((group) => (
                <Card key={group.template} padding={12}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, flex: "1 1 auto", minWidth: 0 }}>
                      {group.template}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 15, color: "#2563eb", flexShrink: 0 }}>
                      {formatPct(group.progressPct)}
                    </span>
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>
                    {t("remaining", { count: group.remaining })} · <b>{group.completed}/{group.target}</b>
                  </div>

                  <div style={progressTrackStyle}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.max(0, Math.min(100, Number(group.progressPct ?? 0)))}%`,
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

        <Card data-onboarding="progress-leaderboard">
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {t("leaderboardTitle", {
              period: selectedPeriod === "daily"
                ? t("leaderboardPeriodDay")
                : selectedPeriod === "weekly"
                  ? t("leaderboardPeriodWeek")
                  : t("leaderboardPeriodMonth"),
            })}
          </div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
            {t("leaderboardSubtitle")}
          </div>

          <div style={panelBodyStyle}>
            {loading ? (
              <div>{t("loading")}</div>
            ) : leaderboard.length === 0 ? (
              <div style={{ opacity: 0.85 }}>{t("noLeaderboard")}</div>
            ) : (
              leaderboard.map((row, idx) => (
                <Card key={row.auditor_user_id} padding={12}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, flex: "1 1 auto", minWidth: 0 }}>
                        #{idx + 1} · {row.auditor_name}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 15, color: "#2563eb", flexShrink: 0 }}>
                        {formatPct(row.progress_pct)}
                      </span>
                    </div>
                    <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                        {t("production")} <b>{row.audits_done}</b> {t("audits")} · {t("average")}{" "}
                        <b>
                          {row.avg_score !== null
                            ? `${Number(row.avg_score).toFixed(1)}%`
                            : "—"}
                        </b>
                      </div>
                      <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                        {t("productionTarget")} <b>{row.targets_completed}</b> / {row.targets_total}
                      </div>

                      <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
                        {(rubricTargetsByAuditor[row.auditor_user_id] ?? []).length === 0 ? (
                          <div style={{ opacity: 0.7, fontSize: 12.5 }}>{t("noRubricTargets")}</div>
                        ) : (
                          rubricTargetsByAuditor[row.auditor_user_id].map((rubric) => (
                            <div
                              key={`${row.auditor_user_id}-${rubric.template}`}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                                fontSize: 12.5,
                                opacity: 0.82,
                              }}
                            >
                              <span
                                style={{
                                  minWidth: 0,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {rubric.template}
                              </span>
                              <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                                {rubric.completed} / {rubric.target}
                              </span>
                            </div>
                          ))
                        )}
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
          <div style={{ fontWeight: 700, fontSize: 16 }}>{t("recentTitle")}</div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
            {t("recentSubtitle", {
              period: selectedPeriod === "daily" ? t("periodToday") : selectedPeriod === "weekly" ? t("periodThisWeek") : t("periodThisMonth"),
            })}
          </div>

          <div style={panelBodyStyle}>
            {loading ? (
              <div>{t("loading")}</div>
            ) : teamRecentRuns.length === 0 ? (
              <div style={{ opacity: 0.85 }}>
                {t("noRecent")}
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
              {t("configTitle")}
            </div>
            <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
              {t("configSubtitle")}
            </div>
          </div>

          <button
            style={btn}
            onClick={() => setShowAssignmentsConfig((prev) => !prev)}
          >
            {showAssignmentsConfig ? t("hideConfig") : t("showConfig")}
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
  );
}
