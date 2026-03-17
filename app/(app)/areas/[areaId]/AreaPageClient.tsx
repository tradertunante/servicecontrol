// FILE: app/(app)/areas/[areaId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BackButton from "@/app/components/BackButton";
import type { Profile } from "@/lib/types";

import type { PeriodKey, Role as AreaRole, TabKey } from "./_lib/areaTypes";
import { safePeriod } from "./_lib/areaUtils";

import AreaHeader from "./_components/AreaHeader";
import AreaTabs from "./_components/AreaTabs";
import DashboardPanel from "./_components/DashboardPanel";
import HistoryPanel from "./_components/HistoryPanel";
import TemplatesPanel from "./_components/TemplatesPanel";

import { useAreaData } from "./_hooks/useAreaData";

export default function AreaPageClient({
  areaId,
  initialProfile,
  initialHotelId,
}: {
  areaId: string;
  initialProfile: Profile;
  initialHotelId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ default dashboard
  const tab = (searchParams.get("tab") ?? "dashboard") as TabKey;

  // ✅ deep-link filters
  const initialTemplate = searchParams.get("template") ?? "ALL";
  const initialPeriod = safePeriod(searchParams.get("period"));

  const [templateFilter, setTemplateFilter] = useState<string>(initialTemplate);
  const [period, setPeriod] = useState<PeriodKey>(initialPeriod);

  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const data = useAreaData({
    areaId,
    templateFilter,
    setTemplateFilter,
    initialProfile,
  });

  // ✅ si vienen sin tab, lo fijamos a dashboard
  useEffect(() => {
    if (!areaId) return;
    const t = searchParams.get("tab");
    if (!t) {
      const qp = new URLSearchParams(searchParams.toString());
      qp.set("tab", "dashboard");
      router.replace(`/areas/${areaId}?${qp.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId]);

  // ✅ sincroniza filtros con URL
  useEffect(() => {
    if (!areaId) return;
    const qp = new URLSearchParams(searchParams.toString());
    qp.set("tab", tab);

    if (templateFilter && templateFilter !== "ALL") qp.set("template", templateFilter);
    else qp.delete("template");

    qp.set("period", period);

    router.replace(`/areas/${areaId}?${qp.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateFilter, period, tab, areaId]);

  // ✅ abre historial filtrado
  function openRunsByFail(opts: { questionId?: string; classification?: string }) {
    const qp = new URLSearchParams(searchParams.toString());
    qp.set("tab", "history");

    // mantenemos contexto de Vista + Periodo
    qp.set("period", period);
    if (templateFilter && templateFilter !== "ALL") qp.set("template", templateFilter);
    else qp.delete("template");

    // filtros de fallo (solo uno a la vez)
    if (opts.questionId) {
      qp.set("fail_q", opts.questionId);
      qp.delete("fail_cls");
    } else {
      qp.delete("fail_q");
    }

    if (opts.classification) {
      qp.set("fail_cls", opts.classification);
      qp.delete("fail_q");
    } else {
      qp.delete("fail_cls");
    }

    router.push(`/areas/${areaId}?${qp.toString()}`);
  }

  const HeaderRow = useMemo(
    () => (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 6,
        }}
      >
        <h1 style={{ fontSize: 56, margin: 0 }}>{data.area?.name ?? "Área"}</h1>
        <BackButton fallback="/areas" />
      </div>
    ),
    [data.area?.name]
  );

  if (data.loading) {
    return (
      <main style={{ padding: 24 }}>
        {HeaderRow}
        <p>Cargando…</p>
      </main>
    );
  }

  if (data.error) {
    return (
      <main style={{ padding: 24 }}>
        {HeaderRow}
        <p style={{ color: "crimson", fontWeight: 800 }}>{data.error}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      {HeaderRow}

      <AreaHeader area={data.area} role={(data.profile?.role as AreaRole | null) ?? null} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, marginBottom: 8 }}>
        <button
          onClick={() => router.push(`/reports/monthly/area/${areaId}?month=${currentMonth}`)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#fff",
            color: "#111",
            fontWeight: 900,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Reporte mensual
        </button>
      </div>

      <AreaTabs
        activeTab={tab}
        onChangeTab={(next) => {
          // al cambiar tab, limpiamos filtros de fail
          const qp = new URLSearchParams(searchParams.toString());
          qp.set("tab", next);
          qp.delete("fail_q");
          qp.delete("fail_cls");
          router.push(`/areas/${areaId}?${qp.toString()}`);
        }}
      />

      {tab === "dashboard" ? (
        <DashboardPanel
          areaId={String(areaId ?? "")}
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
          onOpenFailRuns={(payload) => openRunsByFail(payload)}
        />
      ) : null}

      {tab === "history" ? (
        <HistoryPanel
          areaId={String(areaId ?? "")}
          profileRole={(data.profile?.role as AreaRole | null) ?? null}
          templates={data.templates}
          hotelId={initialHotelId}
          onViewRun={(runId) => router.push(`/audits/${runId}`)}
          onDeleteSuccess={(deletedId) => data.removeRunEverywhere(deletedId)}
        />
      ) : null}

      {tab === "templates" ? (
        <TemplatesPanel templates={data.templates} starting={data.starting} onStart={data.handleStart} />
      ) : null}
    </main>
  );
}
