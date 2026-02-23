// app/components/HeatMap.tsx
"use client";

type HeatMapCell = {
  value: number | null;
  count: number;
};

type HeatMapProps = {
  data: {
    areaName: string;
    months: HeatMapCell[];
  }[];
  monthLabels: string[];
};

function getCellColor(value: number | null): string {
  if (value === null) return "rgba(0,0,0,0.03)";
  if (value < 60) return "#ffcdd2";
  if (value < 70) return "#ffcc80";
  if (value < 80) return "#fff59d";
  if (value < 90) return "#c5e1a5";
  return "#a5d6a7";
}

function getCellTextColor(value: number | null): string {
  if (value === null) return "rgba(0,0,0,0.3)";
  if (value < 60) return "#c62828";
  if (value < 80) return "#ef6c00";
  return "#2e7d32";
}

export default function HeatMap({ data, monthLabels }: HeatMapProps) {
  const stickyBg = "rgba(255,255,255,0.92)";

  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        borderRadius: 14,
      }}
    >
      <table
        style={{
          borderCollapse: "separate",
          borderSpacing: "6px",
          width: "max-content",
          minWidth: "100%",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                position: "sticky",
                left: 0,
                zIndex: 4,
                padding: "10px 14px",
                textAlign: "left",
                fontWeight: 950,
                fontSize: 14,
                opacity: 0.7,
                background: stickyBg,
                borderRadius: 10,
                boxShadow: "10px 0 18px rgba(0,0,0,0.06)",
                whiteSpace: "nowrap",
              }}
            >
              Área
            </th>

            {monthLabels.map((label) => (
              <th
                key={label}
                style={{
                  padding: "10px 10px",
                  textAlign: "center",
                  fontWeight: 950,
                  fontSize: 13,
                  opacity: 0.7,
                  whiteSpace: "nowrap",
                  background: "rgba(255,255,255,0.65)",
                  borderRadius: 10,
                }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row) => (
            <tr key={row.areaName}>
              <td
                title={row.areaName}
                style={{
                  position: "sticky",
                  left: 0,
                  zIndex: 3,
                  padding: "12px 14px",
                  fontWeight: 950,
                  fontSize: 14,
                  whiteSpace: "nowrap",
                  background: stickyBg,
                  borderRadius: 10,
                  boxShadow: "10px 0 18px rgba(0,0,0,0.06)",
                  maxWidth: 220,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {row.areaName}
              </td>

              {row.months.map((cell, idx) => (
                <td
                  key={idx}
                  title={
                    cell.value !== null
                      ? `${cell.value.toFixed(1)}% (${cell.count} ${cell.count === 1 ? "auditoría" : "auditorías"})`
                      : "Sin datos"
                  }
                  style={{
                    padding: "12px 10px",
                    textAlign: "center",
                    background: getCellColor(cell.value),
                    borderRadius: 10,
                    fontWeight: 900,
                    fontSize: 13,
                    color: getCellTextColor(cell.value),
                    cursor: cell.value !== null ? "pointer" : "default",
                    transition: "transform 0.12s ease, box-shadow 0.12s ease",
                    minWidth: 64,
                    whiteSpace: "nowrap",
                    willChange: "transform",
                  }}
                  onMouseEnter={(e) => {
                    if (cell.value !== null) {
                      e.currentTarget.style.transform = "translateY(-1px) scale(1.03)";
                      e.currentTarget.style.boxShadow = "0 6px 14px rgba(0,0,0,0.14)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {cell.value !== null ? `${cell.value.toFixed(0)}%` : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Ajustes específicos móvil */}
      <style jsx>{`
        @media (max-width: 720px) {
          table {
            border-spacing: 6px;
          }
        }
      `}</style>
    </div>
  );
}