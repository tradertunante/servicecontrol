"use client";

import type { CSSProperties } from "react";

type WorstAuditItem = {
  areaId: string;
  areaName: string;
  templateId: string;
  templateName: string;
  score: number | null; // ✅ el hook usa score, NO avg
};

export default function WorstAuditsCard({
  card,
  rowBg,
  border,
  fg,
  miniBtn,
  worst3Audits,
  onGoWorstAuditDetail,
}: {
  card: CSSProperties;
  rowBg: string;
  border: string;
  fg: string;
  miniBtn: CSSProperties;
  worst3Audits: WorstAuditItem[];
  onGoWorstAuditDetail: (areaId: string, templateId: string) => void;
}) {
  const formatPct = (n: number | null | undefined) => {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
    return `${Number(n).toFixed(1)}%`;
  };

  return (
    <div style={card} className="card">
      <div className="sectionTitle">Top 3 peores auditorías</div>

      <div className="list">
        {(worst3Audits ?? []).length === 0 ? (
          <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>
        ) : (
          worst3Audits.slice(0, 3).map((a, i) => (
            <div
              key={`${a.areaId}-${a.templateId}-${i}`}
              className="rowCard"
              style={{
                background: rowBg,
                border: `1px solid ${border}`,
              }}
            >
              <div className="rowLeft">
                <div className="rowBadge">⚠️</div>

                <div style={{ minWidth: 0 }}>
                  <div className="rowTitle">
                    {a.areaName} — {a.templateName}
                  </div>
                </div>
              </div>

              <div className="rowRight">
                <div className="rowScore">{formatPct(a.score)}</div>

                <button
                  className="rowBtn"
                  style={miniBtn}
                  onClick={() =>
                    onGoWorstAuditDetail(a.areaId, a.templateId)
                  }
                >
                  Ver detalle
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rowCard {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          border-radius: 12px;
          gap: 12px;
        }

        .rowLeft {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }

        .rowBadge {
          font-size: 20px;
          flex-shrink: 0;
        }

        .rowTitle {
          font-weight: 950;
          font-size: 15px;
          word-break: break-word;
          color: ${fg};
        }

        .rowRight {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .rowScore {
          font-weight: 950;
          font-size: 18px;
          white-space: nowrap;
        }

        @media (max-width: 720px) {
          .rowCard {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }

          .rowRight {
            justify-content: space-between;
          }

          .rowBtn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}