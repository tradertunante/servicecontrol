"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardPanel from "@/app/(app)/areas/[areaId]/_components/DashboardPanel";
import HistoryPanel from "@/app/(app)/areas/[areaId]/_components/HistoryPanel";
import TemplatesPanel from "@/app/(app)/areas/[areaId]/_components/TemplatesPanel";
import { useAreaData } from "@/app/(app)/areas/[areaId]/_hooks/useAreaData";
import type { PeriodKey } from "@/app/(app)/areas/[areaId]/_lib/areaTypes";

export type ManagerAreaOption = {
  id: string;
  name: string;
  type: string | null;
};

export type ManagerAreaHistoryFilters = {
  templateFilter: string;
  period: PeriodKey;
  questionId?: string;
  classification?: string;
} | null;

export default function ManagerAreaWorkspace({
  mode,
  profileRole,
  areasLoading,
  areasError,
  areaOptions,
  selectedAreaId,
  onSelectArea,
  historyFilters,
  onOpenHistory,
}: {
  mode: "dashboard" | "history" | "templates";
  profileRole: string | null | undefined;
  areasLoading: boolean;
  areasError: string | null;
  areaOptions: ManagerAreaOption[];
  selectedAreaId: string;
  onSelectArea: (areaId: string) => void;
  historyFilters: ManagerAreaHistoryFilters;
  onOpenHistory: (filters: Exclude<ManagerAreaHistoryFilters, null>) => void;
}) {
  const router = useRouter();
  const [templateFilter, setTemplateFilter] = useState("ALL");
  const [period, setPeriod] = useState<PeriodKey>("THIS_MONTH");

  const data = useAreaData({
    areaId: selectedAreaId,
    templateFilter,
    setTemplateFilter,
  });

  useEffect(() => {
    setTemplateFilter("ALL");
    setPeriod("THIS_MONTH");
  }, [selectedAreaId]);

  if (areasLoading) {
    return (
      <div
        style={{
          padding: 14,
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "var(--card-bg)",
          boxShadow: "var(--shadow-sm)",
          fontWeight: 900,
        }}
      >
        Cargando área asignada…
      </div>
    );
  }

  if (areasError) {
    return (
      <div
        style={{
          padding: 14,
          borderRadius: 14,
          border: "1px solid rgba(220,0,0,0.35)",
          background: "rgba(220,0,0,0.06)",
          boxShadow: "var(--shadow-sm)",
          color: "crimson",
          fontWeight: 900,
        }}
      >
        {areasError}
      </div>
    );
  }

  if (areaOptions.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "var(--card-bg)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ fontWeight: 900 }}>No tienes áreas asignadas.</div>
        <div style={{ marginTop: 6, opacity: 0.8 }}>
          Pide a un administrador que te asigne al menos un área para usar este espacio.
        </div>
      </div>
    );
  }

  if (!selectedAreaId) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "var(--card-bg)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ fontWeight: 900 }}>Selecciona un área.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {areaOptions.length > 1 ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid var(--border)",
            background: "var(--card-bg)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8, marginBottom: 6 }}>
            Área activa
          </div>
          <select
            value={selectedAreaId}
            onChange={(e) => onSelectArea(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.18)",
              color: "white",
              outline: "none",
            }}
          >
            {areaOptions.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
                {area.type ? ` · ${area.type}` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {data.loading ? <div style={{ fontWeight: 900 }}>Cargando información del área…</div> : null}
      {data.error ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(220,0,0,0.35)",
            background: "rgba(220,0,0,0.06)",
            color: "crimson",
            fontWeight: 900,
          }}
        >
          {data.error}
        </div>
      ) : null}

      {!data.loading && !data.error ? (
        <>
          {mode === "dashboard" ? (
            <DashboardPanel
              period={period}
              setPeriod={setPeriod}
              templateFilter={templateFilter}
              setTemplateFilter={setTemplateFilter}
              templates={data.templates}
              templateNameById={data.templateNameById}
              totalsByTemplate={data.totalsByTemplate}
              exceptionsByRun={data.exceptionsByRun}
              runs={data.runs}
              answersByRun={data.answersByRun}
              questionMetaById={data.questionMetaById}
              onViewRun={(runId) => router.push(`/audits/${runId}`)}
              onOpenFailRuns={(payload) =>
                onOpenHistory({
                  templateFilter,
                  period,
                  questionId: payload.questionId,
                  classification: payload.classification,
                })
              }
            />
          ) : null}

          {mode === "history" ? (
            <HistoryPanel
              areaId={selectedAreaId}
              profileRole={(profileRole ?? null) as any}
              templates={data.templates}
              onViewRun={(runId) => router.push(`/audits/${runId}`)}
              onDeleteSuccess={(deletedId) => data.removeRunEverywhere(deletedId)}
              embeddedTemplateFilter={historyFilters?.templateFilter ?? null}
              embeddedPeriod={historyFilters?.period ?? null}
              embeddedFailQuestionId={historyFilters?.questionId ?? null}
              embeddedFailClassification={historyFilters?.classification ?? null}
            />
          ) : null}

          {mode === "templates" ? (
            <TemplatesPanel
              templates={data.templates}
              starting={data.starting}
              onStart={data.handleStart}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
