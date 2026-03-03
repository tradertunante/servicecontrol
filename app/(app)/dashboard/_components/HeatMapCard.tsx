// FILE: app/(app)/dashboard/_components/HeatMapCard.tsx
"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import HeatMap from "@/app/components/HeatMap";
import type { HeatMode } from "../_lib/dashboardUtils";

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
  heatMapData: any[];
  heatMapDataInternal: any[];
  heatMapDataQuality: any[];
  monthLabels: string[];
  heatMode: HeatMode;
  setHeatMode: (m: HeatMode) => void;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  availableYears: number[];
}) {
  const [compareMode, setCompareMode] = useState(false);

  const title = useMemo(() => {
    const base = heatMode === "YEAR" ? `Tendencia · Año ${selectedYear}` : "Tendencia · Últimos 12 meses";
    return compareMode ? `${base} · Interno vs Quality` : base;
  }, [heatMode, selectedYear, compareMode]);

  // ✅ En modo comparativo intercalamos: Interno (área + hijos) luego Quality (área + hijos)
  const compareData = useMemo(() => {
    if (!compareMode) return [];

    // Indexar por baseKey (sin sufijo :internal / :quality)
    const stripChannel = (key: string) =>
      key.replace(/:internal/g, "").replace(/:quality/g, "");

    // Separar padres e hijos de internal
    const intParents  = heatMapDataInternal.filter((r) => r.kind === "area");
    const intChildren = heatMapDataInternal.filter((r) => r.kind === "audit");

    // Separar padres e hijos de quality
    const qualParents  = heatMapDataQuality.filter((r) => r.kind === "area");
    const qualChildren = heatMapDataQuality.filter((r) => r.kind === "audit");

    // Mapa de hijos por parentKey base
    const intChildrenByParent = new Map<string, any[]>();
    for (const c of intChildren) {
      const base = stripChannel(c.parentKey ?? "");
      if (!intChildrenByParent.has(base)) intChildrenByParent.set(base, []);
      intChildrenByParent.get(base)!.push(c);
    }

    const qualChildrenByParent = new Map<string, any[]>();
    for (const c of qualChildren) {
      const base = stripChannel(c.parentKey ?? "");
      if (!qualChildrenByParent.has(base)) qualChildrenByParent.set(base, []);
      qualChildrenByParent.get(base)!.push(c);
    }

    // Orden de áreas según interno (o quality si no hay interno)
    const areaBaseKeys = Array.from(new Set([
      ...intParents.map((r) => stripChannel(r.key)),
      ...qualParents.map((r) => stripChannel(r.key)),
    ]));

    const result: any[] = [];

    for (const baseKey of areaBaseKeys) {
      const intParent  = intParents.find((r)  => stripChannel(r.key) === baseKey);
      const qualParent = qualParents.find((r) => stripChannel(r.key) === baseKey);

      const intParentKey  = `compare:internal:${baseKey}`;
      const qualParentKey = `compare:quality:${baseKey}`;

      // ✅ Fila área Interno
      if (intParent) {
        result.push({
          ...intParent,
          key: intParentKey,
          channelLabel: "🔵 Interno",
          compareTag: "internal",
          parentKey: undefined,
        });

        // ✅ Hijos Interno
        const intKids = intChildrenByParent.get(baseKey) ?? [];
        for (const kid of intKids) {
          result.push({
            ...kid,
            key: `compare:internal:${stripChannel(kid.key)}`,
            parentKey: intParentKey,
            channelLabel: "🔵 Interno",
            compareTag: "internal",
          });
        }
      }

      // ✅ Fila área Quality
      if (qualParent) {
        result.push({
          ...qualParent,
          key: qualParentKey,
          channelLabel: "🔍 Quality",
          compareTag: "quality",
          parentKey: undefined,
        });

        // ✅ Hijos Quality
        const qualKids = qualChildrenByParent.get(baseKey) ?? [];
        for (const kid of qualKids) {
          result.push({
            ...kid,
            key: `compare:quality:${stripChannel(kid.key)}`,
            parentKey: qualParentKey,
            channelLabel: "🔍 Quality",
            compareTag: "quality",
          });
        }
      }
    }

    return result;
  }, [compareMode, heatMapDataInternal, heatMapDataQuality]);

  const dataToShow = compareMode ? compareData : heatMapData;

  return (
    <div style={{ ...card, marginTop: 16 }} className="card">
      <div className="headerRow">
        <div>
          <div className="sectionTitle">{title}</div>
          <div className="hint">
            {compareMode
              ? "🔵 Interno = equipo operativo · 🔍 Quality = depto. de calidad"
              : "Tip: haz clic en un área (p. ej. Housekeeping) para ver el desglose por auditoría."}
          </div>
        </div>

        <div className="controls">
          <button
            className={`pill compare ${compareMode ? "compareActive" : ""}`}
            onClick={() => setCompareMode((v) => !v)}
            type="button"
          >
            {compareMode ? "✕ Comparando" : "⇄ Comparar"}
          </button>

          <button
            className={`pill ${heatMode === "ROLLING_12M" ? "active" : ""}`}
            onClick={() => setHeatMode("ROLLING_12M")}
            type="button"
          >
            Últimos 12 meses
          </button>

          <button
            className={`pill ${heatMode === "YEAR" ? "active" : ""}`}
            onClick={() => setHeatMode("YEAR")}
            type="button"
          >
            Año
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

      <div className="heatWrap">
        <div className="heatInner">
          {Array.isArray(dataToShow) && dataToShow.length > 0 ? (
            <HeatMap
              data={dataToShow}
              monthLabels={monthLabels}
              compareMode={compareMode}
            />
          ) : (
            <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .headerRow {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .sectionTitle {
          font-size: 22px;
          font-weight: 950;
          letter-spacing: 0.4px;
          margin-bottom: 6px;
        }

        .hint { opacity: 0.75; font-size: 13px; }

        .controls {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .pill {
          border: 1px solid var(--input-border);
          background: var(--input-bg);
          color: var(--text);
          border-radius: 14px;
          padding: 8px 10px;
          font-weight: 900;
          font-size: 13px;
          box-shadow: var(--shadow-sm);
          cursor: pointer;
          white-space: nowrap;
        }

        .pill.active { outline: 2px solid rgba(0,0,0,0.08); }

        .pill.compare {
          border-color: rgba(147,51,234,0.35);
          color: rgb(126,34,206);
        }

        .pill.compareActive {
          background: rgba(147,51,234,0.10);
          border-color: rgba(147,51,234,0.5);
          color: rgb(126,34,206);
          outline: 2px solid rgba(147,51,234,0.15);
        }

        .yearSelect {
          border: 1px solid var(--input-border);
          background: var(--input-bg);
          color: var(--text);
          border-radius: 12px;
          padding: 8px 10px;
          font-weight: 900;
          font-size: 13px;
          box-shadow: var(--shadow-sm);
        }

        .heatWrap {
          position: relative;
          width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 8px;
        }

        .heatInner { width: max-content; }

        .heatWrap:after {
          content: "";
          position: sticky;
          right: 0;
          top: 0;
          height: 100%;
          width: 28px;
          float: right;
          pointer-events: none;
          background: linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.9));
        }

        @media (max-width: 720px) {
          .headerRow { flex-direction: column; align-items: stretch; }
          .controls { justify-content: flex-start; }
        }
      `}</style>
    </div>
  );
}