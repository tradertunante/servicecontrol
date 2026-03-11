"use client";

import type { ReauditTimelineItem } from "../../_lib/reauditTypes";
import { fmtDate } from "../../_lib/reauditUtils";

export default function ReauditTimeline({
  items,
}: {
  items: ReauditTimelineItem[];
}) {
  if (!items.length) return null;

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: 10,
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
        Historial de la re-auditoría
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((item, index) => (
          <div
            key={item.id}
            style={{
              display: "grid",
              gap: 4,
              paddingLeft: 12,
              borderLeft:
                item.type === "training"
                  ? "3px solid rgba(255,180,0,0.45)"
                  : "3px solid rgba(80,120,255,0.40)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 900 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                {fmtDate(item.occurredAt)}
              </div>
            </div>

            {item.actorName ? (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Por: {item.actorName}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 4 }}>
              {item.detailLines.map((line, lineIndex) => (
                <div
                  key={`${item.id}-${lineIndex}`}
                  style={{ whiteSpace: "pre-wrap", fontSize: 13, overflowWrap: "anywhere" }}
                >
                  {line}
                </div>
              ))}
            </div>

            {index < items.length - 1 ? (
              <div
                style={{
                  marginTop: 4,
                  borderBottom: "1px dashed rgba(0,0,0,0.10)",
                }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
