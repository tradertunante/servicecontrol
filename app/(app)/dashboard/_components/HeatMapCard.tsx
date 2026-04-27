// FILE: app/(app)/dashboard/_components/HeatMapCard.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import HeatMap from "@/app/components/HeatMap";
import type { HeatMode } from "../_lib/dashboardUtils";
import type { HeatRow } from "../_hooks/useDashboardData";

export default function HeatMapCard({
  card,
  heatMapData,
  heatMapDataInternal,
  heatMapDataQuality,
  monthLabels,
  heatMode,
  setHeatMode,
  selectedYear,
  setSelectedYear,
  availableYears,
}: {
  card: CSSProperties;
  heatMapData: HeatRow[];
  heatMapDataInternal: HeatRow[];
  heatMapDataQuality: HeatRow[];
  monthLabels: string[];
  heatMode: HeatMode;
  setHeatMode: (m: HeatMode) => void;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  availableYears: number[];
}) {
  const t = useTranslations("app.dashboard");
  const [compareMode, setCompareMode] = useState(false);
  const heatWrapRef = useRef<HTMLDivElement>(null);

  // En móvil, desplaza automáticamente al mes en curso al cambiar de modo/año
  useEffect(() => {
    const el = heatWrapRef.current;
    if (!el || typeof window === "undefined" || window.innerWidth > 720) return;

    const now = new Date();
    let colIdx: number;
    if (heatMode === "YEAR") {
      // YEAR: columnas Ene(0)..Dic(11)..Media(12)
      colIdx = selectedYear === now.getFullYear() ? now.getMonth() : 0;
    } else {
      // ROLLING_12M: el mes actual es el índice 11 (justo antes de "Media")
      colIdx = 11;
    }

    // móvil: col=82px, gap=8px → paso de 90px por columna
    el.scrollLeft = colIdx * 90;
  }, [heatMode, selectedYear]);

  const title = useMemo(() => {
    const base = heatMode === "YEAR"
      ? `${t("trendYear")} ${selectedYear}`
      : t("trendLast12");
    return compareMode ? `${base} ${t("internalVsQuality")}` : base;
  }, [heatMode, selectedYear, compareMode, t]);

  const compareData = useMemo(() => {
    if (!compareMode) return [];

    const stripChannel = (key: string) =>
      key.replace(/:internal/g, "").replace(/:quality/g, "");

    const intParents  = heatMapDataInternal.filter((r) => r.kind === "area");
    const intChildren = heatMapDataInternal.filter((r) => r.kind === "audit");
    const qualParents  = heatMapDataQuality.filter((r) => r.kind === "area");
    const qualChildren = heatMapDataQuality.filter((r) => r.kind === "audit");

    const intChildrenByParent = new Map<string, HeatRow[]>();
    for (const c of intChildren) {
      const base = stripChannel(c.parentKey ?? "");
      if (!intChildrenByParent.has(base)) intChildrenByParent.set(base, []);
      intChildrenByParent.get(base)!.push(c);
    }

    const qualChildrenByParent = new Map<string, HeatRow[]>();
    for (const c of qualChildren) {
      const base = stripChannel(c.parentKey ?? "");
      if (!qualChildrenByParent.has(base)) qualChildrenByParent.set(base, []);
      qualChildrenByParent.get(base)!.push(c);
    }

    const areaBaseKeys = Array.from(new Set([
      ...intParents.map((r) => stripChannel(r.key)),
      ...qualParents.map((r) => stripChannel(r.key)),
    ]));

    const result: HeatRow[] = [];

    for (const baseKey of areaBaseKeys) {
      const intParent  = intParents.find((r)  => stripChannel(r.key) === baseKey);
      const qualParent = qualParents.find((r) => stripChannel(r.key) === baseKey);
      const intParentKey  = `compare:internal:${baseKey}`;
      const qualParentKey = `compare:quality:${baseKey}`;

      if (intParent) {
        result.push({ ...intParent, key: intParentKey, channelLabel: "🔵 Internal", compareTag: "internal", parentKey: undefined });
        const intKids = intChildrenByParent.get(baseKey) ?? [];
        for (const kid of intKids) {
          result.push({ ...kid, key: `compare:internal:${stripChannel(kid.key)}`, parentKey: intParentKey, channelLabel: "🔵 Internal", compareTag: "internal" });
        }
      }

      if (qualParent) {
        result.push({ ...qualParent, key: qualParentKey, channelLabel: "🔍 Quality", compareTag: "quality", parentKey: undefined });
        const qualKids = qualChildrenByParent.get(baseKey) ?? [];
        for (const kid of qualKids) {
          result.push({ ...kid, key: `compare:quality:${stripChannel(kid.key)}`, parentKey: qualParentKey, channelLabel: "🔍 Quality", compareTag: "quality" });
        }
      }
    }

    return result;
  }, [compareMode, heatMapDataInternal, heatMapDataQuality]);

  const dataToShow = compareMode ? compareData : heatMapData;

  return (
    <div style={{ ...card, marginTop: 16 }} className="card" data-onboarding="heatmap">
      <div className="headerRow">
        <div>
          <div className="sectionTitle">{title}</div>
          <div className="hint">
            {compareMode ? t("internalLegend") : t("clickAreaTip")}
          </div>
        </div>

        <div className="controls">
          <button
            className={`pill compare ${compareMode ? "compareActive" : ""}`}
            onClick={() => setCompareMode((v) => !v)}
            type="button"
          >
            {compareMode ? t("stopComparing") : t("compare")}
          </button>

          <button
            className={`pill ${heatMode === "ROLLING_12M" ? "active" : ""}`}
            onClick={() => setHeatMode("ROLLING_12M")}
            type="button"
          >
            {t("last12Months")}
          </button>

          <button
            className={`pill ${heatMode === "YEAR" ? "active" : ""}`}
            onClick={() => setHeatMode("YEAR")}
            type="button"
          >
            {t("year")}
          </button>

          {heatMode === "YEAR" && (
            <select
              className="yearSelect"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="heatWrap" ref={heatWrapRef}>
        <div className="heatInner">
          {Array.isArray(dataToShow) && dataToShow.length > 0 ? (
            <HeatMap data={dataToShow} monthLabels={monthLabels} compareMode={compareMode} />
          ) : (
            <div style={{ opacity: 0.7 }}>{t("noData")}</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .headerRow { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
        .sectionTitle { font-size: 22px; font-weight: 950; letter-spacing: 0.4px; margin-bottom: 6px; }
        .hint { opacity: 0.75; font-size: 13px; }
        .controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .pill { border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text); border-radius: 14px; padding: 8px 10px; font-weight: 900; font-size: 13px; box-shadow: var(--shadow-sm); cursor: pointer; white-space: nowrap; }
        .pill.active { outline: 2px solid rgba(0,0,0,0.08); }
        .pill.compare { border-color: rgba(147,51,234,0.35); color: rgb(126,34,206); }
        .pill.compareActive { background: rgba(147,51,234,0.10); border-color: rgba(147,51,234,0.5); color: rgb(126,34,206); outline: 2px solid rgba(147,51,234,0.15); }
        .yearSelect { border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text); border-radius: 12px; padding: 8px 10px; font-weight: 900; font-size: 13px; box-shadow: var(--shadow-sm); }
        .heatWrap { position: relative; width: 100%; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; padding-bottom: 8px; }
        .heatInner { width: max-content; }
        .heatWrap:after { content: ""; position: sticky; right: 0; top: 0; height: 100%; width: 28px; float: right; pointer-events: none; background: linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.9)); }
        @media (max-width: 720px) { .headerRow { flex-direction: column; align-items: stretch; } .controls { justify-content: flex-start; } }
      `}</style>
    </div>
  );
}
