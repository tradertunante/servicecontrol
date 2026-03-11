// FILE: app/(app)/team/_components/ReauditsPanel.tsx
"use client";

import { useMemo, useState } from "react";
import type { Profile } from "@/lib/types";

import ReauditStats from "./reaudits/ReauditStats";
import ReauditFilters from "./reaudits/ReauditFilters";
import ReauditCard from "./reaudits/ReauditCard";

import { useReauditsData } from "../_hooks/useReauditsData";
import { useReauditActions } from "../_hooks/useReauditActions";

export default function ReauditsPanel({
  profile,
  hotelId,
}: {
  profile: Profile | null;
  hotelId: string;
}) {
  const {
    loading,
    error: dataError,
    rows,
    auditorOptions,
    auditorOptionsByAreaId,
    stats,
    loadData,
    latestTrainingLogByRunId,
    timelineByRunId,
  } = useReauditsData({ profile, hotelId });

  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending_training" | "blocked_by_non_operational" | "draft"
  >("all");
  const [q, setQ] = useState("");

  const [openTrainingId, setOpenTrainingId] = useState<string | null>(null);
  const [trainingExplanation, setTrainingExplanation] = useState<
    Record<string, string>
  >({});

  const [reassignAuditorId, setReassignAuditorId] = useState<
    Record<string, string>
  >({});
  const [reassignNote, setReassignNote] = useState<Record<string, string>>({});

  const {
    savingId,
    actionError,
    message,
    clearActionFeedback,
    confirmTraining,
    saveReassignment,
  } = useReauditActions({
    profile,
    auditorOptions,
    onReload: loadData,
  });

  const canManageReauditAssignment = [
    "manager",
    "quality",
    "admin",
    "superadmin",
  ].includes((profile?.role ?? "").toLowerCase());

  const filtered = useMemo(() => {
    let list = [...rows];

    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }

    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((r) =>
        [
          r.area_name ?? "",
          r.area_type ?? "",
          r.template_name ?? "",
          r.team_member_name ?? "",
          r.assigned_auditor_name ?? "",
          r.status ?? "",
          r.origin_type ?? "",
          r.notes ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      );
    }

    return list;
  }, [rows, statusFilter, q]);

  const visibleError = actionError || dataError;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ReauditStats stats={stats} />

      <ReauditFilters
        q={q}
        onQChange={setQ}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onReload={loadData}
      />

      {visibleError ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(220,0,0,0.35)",
            background: "rgba(220,0,0,0.06)",
            color: "crimson",
            fontWeight: 900,
          }}
        >
          {visibleError}
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "rgba(0,200,0,0.10)",
            color: "green",
            fontWeight: 900,
          }}
        >
          {message}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {loading ? (
          <div style={{ fontWeight: 900 }}>Cargando re-auditorías…</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 900 }}>No hay re-auditorías</div>
            <div style={{ marginTop: 6, color: "var(--muted)" }}>
              No hay registros para los filtros actuales.
            </div>
          </div>
        ) : (
          filtered.map((row) => {
            const busy = savingId === row.id;

            return (
              <ReauditCard
                key={row.id}
                row={row}
                busy={busy}
                canManageReauditAssignment={canManageReauditAssignment}
                auditorOptions={auditorOptionsByAreaId[row.area_id] ?? []}
                trainingValue={trainingExplanation[row.id] ?? ""}
                reassignAuditorValue={
                  reassignAuditorId[row.id] !== undefined
                    ? reassignAuditorId[row.id]
                    : row.assigned_auditor_id ?? ""
                }
                reassignNoteValue={reassignNote[row.id] ?? ""}
                trainingInfo={latestTrainingLogByRunId[row.id] ?? null}
                timelineItems={timelineByRunId[row.id] ?? []}
                isTrainingOpen={openTrainingId === row.id}
                onTrainingOpen={() => {
                  clearActionFeedback();
                  setOpenTrainingId(row.id);
                }}
                onTrainingCancel={() => setOpenTrainingId(null)}
                onTrainingChange={(value) =>
                  setTrainingExplanation((prev) => ({
                    ...prev,
                    [row.id]: value,
                  }))
                }
                onTrainingSave={async () => {
                  await confirmTraining({
                    row,
                    explanation: trainingExplanation[row.id] ?? "",
                    onSuccess: () => {
                      setTrainingExplanation((prev) => ({
                        ...prev,
                        [row.id]: "",
                      }));
                      setOpenTrainingId(null);
                    },
                  });
                }}
                onReassignAuditorChange={(value) =>
                  setReassignAuditorId((prev) => ({
                    ...prev,
                    [row.id]: value,
                  }))
                }
                onReassignNoteChange={(value) =>
                  setReassignNote((prev) => ({
                    ...prev,
                    [row.id]: value,
                  }))
                }
                onReassignSave={async () => {
                  await saveReassignment({
                    row,
                    nextAuditorId:
                      reassignAuditorId[row.id] !== undefined
                        ? reassignAuditorId[row.id]
                        : row.assigned_auditor_id ?? "",
                    note: reassignNote[row.id] ?? "",
                    onSuccess: () => {
                      setReassignAuditorId((prev) => ({
                        ...prev,
                        [row.id]: "",
                      }));
                      setReassignNote((prev) => ({
                        ...prev,
                        [row.id]: "",
                      }));
                    },
                  });
                }}
                onReassignReset={() => {
                  setReassignAuditorId((prev) => ({
                    ...prev,
                    [row.id]: row.assigned_auditor_id ?? "",
                  }));
                  setReassignNote((prev) => ({
                    ...prev,
                    [row.id]: "",
                  }));
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
