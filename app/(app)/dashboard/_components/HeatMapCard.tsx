// FILE: app/(app)/dashboard/_components/HeatMapCard.tsx
"use client";

import type { CSSProperties } from "react";
import HeatMap from "@/app/components/HeatMap";

export default function HeatMapCard({
  card,
  heatMapData,
  monthLabels,
}: {
  card: CSSProperties;
  heatMapData: any[];
  monthLabels: string[];
}) {
  return (
    <div style={{ ...card, marginTop: 16 }} className="card">
      <div className="sectionTitle">Tendencia · 12M</div>

      <div className="heatWrap">
        <div className="heatInner">
          {heatMapData.length > 0 ? (
            <HeatMap data={heatMapData} monthLabels={monthLabels} />
          ) : (
            <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .heatWrap {
          position: relative;
          width: 100%;
          overflow-x: auto; /* ✅ desktop + mobile */
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 8px;
        }

        /* Deja que el contenido sea tan ancho como necesite */
        .heatInner {
          width: max-content;
        }

        /* Indicador visual de que hay scroll a la derecha */
        .heatWrap:after {
          content: "";
          position: sticky;
          right: 0;
          top: 0;
          height: 100%;
          width: 28px;
          float: right;
          pointer-events: none;
          background: linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.9));
        }
      `}</style>
    </div>
  );
}