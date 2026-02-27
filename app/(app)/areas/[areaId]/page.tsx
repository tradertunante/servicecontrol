// FILE: app/(app)/areas/[areaId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import BackButton from "@/app/components/BackButton";

import type { PeriodKey, TabKey } from "./_lib/areaTypes";
import { safePeriod } from "./_lib/areaUtils";

import AreaHeader from "./_components/AreaHeader";
import AreaTabs from "./_components/AreaTabs";
import DashboardPanel from "./_components/DashboardPanel";
import HistoryPanel from "./_components/HistoryPanel";
import TemplatesPanel from "./_components/TemplatesPanel";

import { useAreaData } from "./_hooks/useAreaData";

export default function AreaPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  // ✅ soporta carpeta [id] o [areaId]
  const areaId = (params as any)?.areaId ?? (params as any)?.id;

  // ✅ default dashboard
  const tab = (searchParams.get("tab") ?? "dashboard") as TabKey;

  // ✅ deep-link filters
  const initialTemplate = searchParams.get("template") ?? "ALL";
  const initialPeriod = safePeriod(searchParams.get("period"));

  const [templateFilter, setTemplateFilter] = useState<string>(initialTemplate);
  const [period, setPeriod] = useState<PeriodKey>(initialPeriod);

  const data = useAreaData({
    areaId: String(areaId ?? ""),
    templateFilter,
    setTemplateFilter,
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

  // ✅ abre historial filtrado (para ver comentarios/fotos sobre qué falló)
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

      <AreaHeader area={data.area} role={data.profile?.role ?? null} />

      <AreaTabs
        activeTab={tab}
        onChangeTab={(next) => {
          // al cambiar tab, limpiamos filtros de fail para evitar “quedarse pegados”
          const qp = new URLSearchParams(searchParams.toString());
          qp.set("tab", next);
          qp.delete("fail_q");
          qp.delete("fail_cls");
          router.push(`/areas/${areaId}?${qp.toString()}`);
        }}
      />

      {tab === "dashboard" ? (
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
          onOpenFailRuns={(payload) => openRunsByFail(payload)}
        />
      ) : null}

      {tab === "history" ? (
        <HistoryPanel
          areaId={String(areaId ?? "")}
          profileRole={data.profile?.role ?? null}
          templates={data.templates}
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