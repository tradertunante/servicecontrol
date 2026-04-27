"use client";

import Card from "@/components/ui/Card";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardPanel from "@/app/(app)/areas/[areaId]/_components/DashboardPanel";
import HistoryPanel from "@/app/(app)/areas/[areaId]/_components/HistoryPanel";
import TemplatesPanel from "@/app/(app)/areas/[areaId]/_components/TemplatesPanel";
import { useAreaData } from "@/app/(app)/areas/[areaId]/_hooks/useAreaData";
import type { PeriodKey } from "@/app/(app)/areas/[areaId]/_lib/areaTypes";
import { useManagerAreaTemplates } from "../_hooks/useManagerAreaTemplates";

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
  hotelId,
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
  hotelId: string;
  areasLoading: boolean;
  areasError: string | null;
  areaOptions: ManagerAreaOption[];
  selectedAreaId: string;
  onSelectArea: (areaId: string) => void;
  historyFilters: ManagerAreaHistoryFilters;
  onOpenHistory: (filters: Exclude<ManagerAreaHistoryFilters, null>) => void;
}) {
  const t = useTranslations("app.team.workspace");
  const [templateFilter, setTemplateFilter] = useState("ALL");
  const [period, setPeriod] = useState<PeriodKey>("THIS_MONTH");

  useEffect(() => {
    setTemplateFilter("ALL");
    setPeriod("THIS_MONTH");
  }, [selectedAreaId]);

  if (areasLoading) {
    return (
      <Card style={{ fontWeight: 900 }}>
        {t("loadingArea")}
      </Card>
    );
  }

  if (areasError) {
    return (
      <Card
        style={{
          border: "1px solid rgba(220,0,0,0.35)",
          background: "rgba(220,0,0,0.06)",
          color: "crimson",
          fontWeight: 900,
        }}
      >
        {areasError}
      </Card>
    );
  }

  if (areaOptions.length === 0) {
    return (
      <Card padding={16}>
        <div style={{ fontWeight: 900 }}>{t("noAreas")}</div>
        <div style={{ marginTop: 6, opacity: 0.8 }}>
          {t("noAreasDesc")}
        </div>
      </Card>
    );
  }

  if (!selectedAreaId) {
    return (
      <Card padding={16}>
        <div style={{ fontWeight: 900 }}>{t("selectArea")}</div>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {areaOptions.length > 1 ? (
        <Card>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8, marginBottom: 6 }}>
            {t("activeArea")}
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
        </Card>
      ) : null}

      {mode === "dashboard" ? (
        <ManagerAreaDashboardMode
          areaId={selectedAreaId}
          profileRole={profileRole}
          hotelId={hotelId}
          templateFilter={templateFilter}
          setTemplateFilter={setTemplateFilter}
          period={period}
          setPeriod={setPeriod}
          onOpenHistory={onOpenHistory}
        />
      ) : null}

      {mode === "history" ? (
        <ManagerAreaHistoryMode
          areaId={selectedAreaId}
          profileRole={profileRole}
          hotelId={hotelId}
          historyFilters={historyFilters}
        />
      ) : null}

      {mode === "templates" ? (
        <ManagerAreaTemplatesMode
          areaId={selectedAreaId}
          profileRole={profileRole}
          hotelId={hotelId}
        />
      ) : null}
    </div>
  );
}

function ManagerAreaDashboardMode({
  areaId,
  profileRole,
  hotelId,
  templateFilter,
  setTemplateFilter,
  period,
  setPeriod,
  onOpenHistory,
}: {
  areaId: string;
  profileRole: string | null | undefined;
  hotelId: string;
  templateFilter: string;
  setTemplateFilter: (v: string) => void;
  period: PeriodKey;
  setPeriod: (p: PeriodKey) => void;
  onOpenHistory: (filters: Exclude<ManagerAreaHistoryFilters, null>) => void;
}) {
  const router = useRouter();
  const t = useTranslations("app.team.workspace");
  const data = useAreaData({
    areaId,
    templateFilter,
    setTemplateFilter,
  });
  const templatesData = useManagerAreaTemplates({ areaId, profileRole, initialHotelId: hotelId });

  if (data.loading) {
    return <div style={{ fontWeight: 900 }}>{t("loadingAreaData")}</div>;
  }

  if (data.error) {
    return (
      <Card
        style={{
          border: "1px solid rgba(220,0,0,0.35)",
          background: "rgba(220,0,0,0.06)",
          color: "crimson",
          fontWeight: 900,
        }}
      >
        {data.error}
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {templatesData.templates.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {templatesData.templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="flex-shrink-0 flex items-center justify-between gap-3 bg-white text-black rounded-[14px] px-4 py-2.5"
            >
              <span className="text-[13px] font-bold whitespace-nowrap">{tmpl.name}</span>
              <button
                onClick={() => templatesData.handleStart(tmpl.id)}
                disabled={templatesData.starting === tmpl.id}
                className="px-3 h-7 rounded-[8px] text-[12px] font-bold bg-black text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {templatesData.starting === tmpl.id ? "Iniciando…" : "Iniciar"}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <DashboardPanel
        areaId={areaId}
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
    </div>
  );
}

function ManagerAreaHistoryMode({
  areaId,
  profileRole,
  hotelId,
  historyFilters,
}: {
  areaId: string;
  profileRole: string | null | undefined;
  hotelId: string;
  historyFilters: ManagerAreaHistoryFilters;
}) {
  const router = useRouter();
  const t = useTranslations("app.team.workspace");
  const templatesData = useManagerAreaTemplates({ areaId, profileRole, initialHotelId: hotelId });

  if (templatesData.loading) {
    return <div style={{ fontWeight: 900 }}>{t("loadingAreaData")}</div>;
  }

  if (templatesData.error) {
    return (
      <Card
        style={{
          border: "1px solid rgba(220,0,0,0.35)",
          background: "rgba(220,0,0,0.06)",
          color: "crimson",
          fontWeight: 900,
        }}
      >
        {templatesData.error}
      </Card>
    );
  }

  return (
    <HistoryPanel
      areaId={areaId}
      profileRole={(profileRole ?? null) as any}
      templates={templatesData.templates}
      hotelId={hotelId}
      onViewRun={(runId) => router.push(`/audits/${runId}`)}
      onDeleteSuccess={() => {}}
      embeddedTemplateFilter={historyFilters?.templateFilter ?? null}
      embeddedPeriod={historyFilters?.period ?? null}
      embeddedFailQuestionId={historyFilters?.questionId ?? null}
      embeddedFailClassification={historyFilters?.classification ?? null}
    />
  );
}

function ManagerAreaTemplatesMode({
  areaId,
  profileRole,
  hotelId,
}: {
  areaId: string;
  profileRole: string | null | undefined;
  hotelId: string;
}) {
  const t = useTranslations("app.team.workspace");
  const templatesData = useManagerAreaTemplates({ areaId, profileRole, initialHotelId: hotelId });

  if (templatesData.loading) {
    return <div style={{ fontWeight: 900 }}>{t("loadingAreaData")}</div>;
  }

  if (templatesData.error) {
    return (
      <Card
        style={{
          border: "1px solid rgba(220,0,0,0.35)",
          background: "rgba(220,0,0,0.06)",
          color: "crimson",
          fontWeight: 900,
        }}
      >
        {templatesData.error}
      </Card>
    );
  }

  return (
    <TemplatesPanel
      templates={templatesData.templates}
      starting={templatesData.starting}
      onStart={templatesData.handleStart}
    />
  );
}
