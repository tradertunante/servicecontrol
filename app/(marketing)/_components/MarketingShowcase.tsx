import Card from "@/components/ui/Card";

type Tone = "neutral" | "ok" | "warn" | "danger" | "quality";

function badgePalette(tone: Tone) {
  if (tone === "ok") {
    return {
      background: "var(--ok-bg)",
      border: "1px solid var(--ok-border)",
      color: "var(--ok)",
    };
  }

  if (tone === "warn") {
    return {
      background: "var(--warn-bg)",
      border: "1px solid var(--warn-border)",
      color: "var(--warn)",
    };
  }

  if (tone === "danger") {
    return {
      background: "var(--danger-bg)",
      border: "1px solid var(--danger-border)",
      color: "var(--danger)",
    };
  }

  if (tone === "quality") {
    return {
      background: "var(--quality-badge-bg)",
      border: "1px solid var(--quality-badge-border)",
      color: "var(--quality-badge-text)",
    };
  }

  return {
    background: "var(--neutral-bg)",
    border: "1px solid var(--neutral-border)",
    color: "var(--text)",
  };
}

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em]"
      style={badgePalette(tone)}
    >
      {label}
    </span>
  );
}

function MiniMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <Card
      radius={14}
      padding={12}
      className="min-w-0"
      style={{
        background:
          tone === "neutral"
            ? "var(--card-bg)"
            : badgePalette(tone).background,
        border: badgePalette(tone).border,
      }}
    >
      <div className="text-[12px] font-extrabold text-[var(--text-secondary)]">{label}</div>
      <div className="mt-1 text-[28px] font-black leading-none text-[var(--text)]">{value}</div>
    </Card>
  );
}

function RankingRow({
  area,
  score,
  note,
  tone,
}: {
  area: string;
  score: string;
  note: string;
  tone: Tone;
}) {
  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl px-4 py-3"
      style={{
        background: "var(--row-bg)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="min-w-0">
        <div className="truncate text-[14px] font-black text-[var(--text)]">{area}</div>
        <div className="mt-1 text-[12px] font-bold text-[var(--text-secondary)]">{note}</div>
      </div>
      <div className="text-right">
        <div className="text-[20px] font-black leading-none text-[var(--text)]">{score}</div>
        <div className="mt-1">
          <StatusPill label={tone === "danger" ? "Atencion" : "Estable"} tone={tone} />
        </div>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  width,
}: {
  label: string;
  value: string;
  width: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[13px] font-extrabold text-[var(--text)]">
        <span>{label}</span>
        <span className="text-[var(--text-secondary)]">{value}</span>
      </div>
      <div
        className="mt-2 h-2 rounded-full"
        style={{ background: "rgba(15, 23, 42, 0.08)" }}
      >
        <div
          className="h-2 rounded-full"
          style={{
            width,
            background: "rgba(15, 23, 42, 0.82)",
          }}
        />
      </div>
    </div>
  );
}

function GaugeRing({ score, label, count }: { score: number; label: string; count: number }) {
  const r = 38;
  const stroke = 8;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[11px] font-black text-[var(--text-secondary)]">{label}</div>
      <svg width={96} height={96} viewBox="0 0 96 96">
        <circle cx={48} cy={48} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={stroke} />
        <circle
          cx={48}
          cy={48}
          r={r}
          fill="none"
          stroke="#2d6a4f"
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
        <text x={48} y={44} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '14px', fontWeight: 900 }} fill="var(--text)">
          {score}%
        </text>
        <text x={48} y={57} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '8.5px', fontWeight: 700 }} fill="var(--text-secondary)">
          ({count} auditorias)
        </text>
      </svg>
    </div>
  );
}

function HeatCell({ value, count, tone }: { value?: string; count?: number; tone?: Tone }) {
  if (!value) return <td className="px-1.5 py-1 text-center text-[10px] text-[var(--text-secondary)]">—</td>;
  const bg = tone === "ok" ? "rgba(45,106,79,0.12)" : tone === "warn" ? "rgba(230,160,30,0.15)" : tone === "danger" ? "rgba(200,50,50,0.14)" : "rgba(0,0,0,0.04)";
  return (
    <td className="px-1 py-1 text-center">
      <span className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-black" style={{ background: bg }}>
        {value}{count != null && <span className="ml-0.5 text-[8px] font-bold opacity-60">({count})</span>}
      </span>
    </td>
  );
}

function TrendChart() {
  // Chart area: x 30..370, y 8..148. Y mapping: 70%→148, 100%→8
  // y = 148 - ((val-70)/30)*140
  // X positions for 6 months: 30, 98, 166, 234, 302, 370
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
  const yLabels = [100, 90, 80, 70];
  const toY = (v: number) => 148 - ((v - 70) / 30) * 140;
  const xs = [30, 98, 166, 234, 302, 370];
  const areas = [
    { name: "Front Office", data: [81,76,84,85,87,88], color: "#2563eb" },
    { name: "Housekeeping", data: [72,81,84,86,85,87], color: "#d03030" },
    { name: "IRD", data: [89,89,91,88,92,90], color: "#2d6a4f" },
    { name: "Restaurante", data: [82,88,87,90,93,94], color: "#e07020" },
    { name: "Spa", data: [91,93,90,94,95,96], color: "#8b5cf6" },
    { name: "Reservas", data: [78,80,83,84,85,86], color: "#0891b2" },
    { name: "Pool", data: [85,82,86,88,90,91], color: "#ca8a04" },
  ];
  return (
    <svg viewBox="0 0 400 168" className="h-full w-full">
      {/* Grid lines */}
      {yLabels.map((pct) => {
        const y = toY(pct);
        return (
          <g key={pct}>
            <line x1={30} y1={y} x2={370} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth={0.5} />
            <text x={26} y={y + 3} textAnchor="end" className="text-[8px]" fill="var(--text-secondary)">{pct}%</text>
          </g>
        );
      })}
      {/* X axis labels */}
      {months.map((m, i) => (
        <text key={m} x={xs[i]} y={164} textAnchor="middle" className="text-[8px] font-bold" fill="var(--text-secondary)">{m}</text>
      ))}
      {/* Lines + dots */}
      {areas.map((a) => {
        const d = a.data.map((v, i) => `${i === 0 ? "M" : "L"}${xs[i]},${toY(v)}`).join(" ");
        return (
          <g key={a.name}>
            <path d={d} fill="none" stroke={a.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {a.data.map((v, i) => (
              <circle key={i} cx={xs[i]} cy={toY(v)} r={3} fill="white" stroke={a.color} strokeWidth={1.5} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export function ProductDashboardMock() {
  return (
    <div
      className="overflow-hidden rounded-[28px] p-3 sm:p-4"
      style={{
        background: "rgba(255,255,255,0.55)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] px-4 py-3"
        style={{
          background: "var(--header-bg)",
          border: "1px solid var(--header-border)",
          boxShadow: "var(--header-shadow)",
        }}
      >
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-secondary)]">
            Hotel Riviera
          </div>
          <div className="mt-1 text-[20px] font-black leading-none text-[var(--text)]">
            Dashboard
          </div>
        </div>
      </div>

      {/* Gauges */}
      <Card radius={18} padding={14} className="mt-3">
        <div className="flex items-center justify-around">
          <GaugeRing score={90} label="Junio 2026" count={48} />
          <GaugeRing score={89} label="Q2 2026" count={126} />
          <GaugeRing score={87} label="Año 2026" count={290} />
        </div>
      </Card>

      {/* Heatmap */}
      <Card radius={18} padding={14} className="mt-3">
        <div className="text-[12px] font-black text-[var(--text)]">Tendencia · Año 2026</div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="text-[9px] font-bold text-[var(--text-secondary)]">
                <th className="text-left font-black py-1 pr-2">Departamento</th>
                <th className="px-1 py-1">Ene</th>
                <th className="px-1 py-1">Feb</th>
                <th className="px-1 py-1">Mar</th>
                <th className="px-1 py-1">Abr</th>
                <th className="px-1 py-1">May</th>
                <th className="px-1 py-1">Jun</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="pr-2 py-1 text-[10px] font-black text-[var(--text)] whitespace-nowrap"><span className="text-[7px] opacity-50 mr-0.5">&#9654;</span> Reservas</td>
                <HeatCell value="78%" count={4} tone="warn" />
                <HeatCell value="80%" count={3} tone="warn" />
                <HeatCell value="83%" count={5} tone="warn" />
                <HeatCell value="84%" count={4} tone="warn" />
                <HeatCell value="85%" count={6} tone="ok" />
                <HeatCell value="86%" count={5} tone="ok" />
              </tr>
              <tr>
                <td className="pr-2 py-1 text-[10px] font-black text-[var(--text)] whitespace-nowrap"><span className="text-[7px] opacity-50 mr-0.5">&#9660;</span> Front Office</td>
                <HeatCell value="81%" count={27} tone="warn" />
                <HeatCell value="76%" count={4} tone="danger" />
                <HeatCell value="84%" count={13} tone="warn" />
                <HeatCell value="85%" count={10} tone="ok" />
                <HeatCell value="87%" count={8} tone="ok" />
                <HeatCell value="88%" count={11} tone="ok" />
              </tr>
              <tr>
                <td className="pr-2 py-1 pl-4 text-[10px] font-bold text-[var(--text-secondary)] whitespace-nowrap">Check In</td>
                <HeatCell value="83%" count={14} tone="warn" />
                <HeatCell value="74%" count={2} tone="danger" />
                <HeatCell value="86%" count={7} tone="ok" />
                <HeatCell value="87%" count={5} tone="ok" />
                <HeatCell value="89%" count={4} tone="ok" />
                <HeatCell value="90%" count={6} tone="ok" />
              </tr>
              <tr>
                <td className="pr-2 py-1 pl-4 text-[10px] font-bold text-[var(--text-secondary)] whitespace-nowrap">Check Out</td>
                <HeatCell value="79%" count={13} tone="warn" />
                <HeatCell value="78%" count={2} tone="warn" />
                <HeatCell value="82%" count={6} tone="warn" />
                <HeatCell value="83%" count={5} tone="warn" />
                <HeatCell value="85%" count={4} tone="ok" />
                <HeatCell value="86%" count={5} tone="ok" />
              </tr>
              <tr>
                <td className="pr-2 py-1 text-[10px] font-black text-[var(--text)] whitespace-nowrap"><span className="text-[7px] opacity-50 mr-0.5">&#9654;</span> Housekeeping</td>
                <HeatCell value="72%" count={5} tone="warn" />
                <HeatCell value="81%" count={4} tone="warn" />
                <HeatCell value="84%" count={31} tone="warn" />
                <HeatCell value="86%" count={9} tone="ok" />
                <HeatCell value="85%" count={7} tone="ok" />
                <HeatCell value="87%" count={12} tone="ok" />
              </tr>
              <tr>
                <td className="pr-2 py-1 text-[10px] font-black text-[var(--text)] whitespace-nowrap"><span className="text-[7px] opacity-50 mr-0.5">&#9654;</span> Pool</td>
                <HeatCell value="85%" count={2} tone="ok" />
                <HeatCell value="82%" count={3} tone="warn" />
                <HeatCell value="86%" count={4} tone="ok" />
                <HeatCell value="88%" count={5} tone="ok" />
                <HeatCell value="90%" count={6} tone="ok" />
                <HeatCell value="91%" count={7} tone="ok" />
              </tr>
              <tr>
                <td className="pr-2 py-1 text-[10px] font-black text-[var(--text)] whitespace-nowrap"><span className="text-[7px] opacity-50 mr-0.5">&#9654;</span> IRD</td>
                <HeatCell value="89%" count={2} tone="ok" />
                <HeatCell value="89%" count={1} tone="ok" />
                <HeatCell value="91%" count={3} tone="ok" />
                <HeatCell value="88%" count={2} tone="ok" />
                <HeatCell value="92%" count={4} tone="ok" />
                <HeatCell value="90%" count={3} tone="ok" />
              </tr>
              <tr>
                <td className="pr-2 py-1 text-[10px] font-black text-[var(--text)] whitespace-nowrap"><span className="text-[7px] opacity-50 mr-0.5">&#9654;</span> Restaurante</td>
                <HeatCell value="82%" count={3} tone="warn" />
                <HeatCell value="88%" count={2} tone="ok" />
                <HeatCell value="87%" count={3} tone="ok" />
                <HeatCell value="90%" count={5} tone="ok" />
                <HeatCell value="93%" count={4} tone="ok" />
                <HeatCell value="94%" count={6} tone="ok" />
              </tr>
              <tr>
                <td className="pr-2 py-1 text-[10px] font-black text-[var(--text)] whitespace-nowrap"><span className="text-[7px] opacity-50 mr-0.5">&#9654;</span> Spa</td>
                <HeatCell value="91%" count={3} tone="ok" />
                <HeatCell value="93%" count={2} tone="ok" />
                <HeatCell value="90%" count={4} tone="ok" />
                <HeatCell value="94%" count={3} tone="ok" />
                <HeatCell value="95%" count={5} tone="ok" />
                <HeatCell value="96%" count={4} tone="ok" />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Trend chart */}
      <Card radius={18} padding={14} className="mt-3">
        <div className="text-[12px] font-black text-[var(--text)]">Tendencia por area</div>
        <div className="mt-3 h-[220px]">
          <TrendChart />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {[
            { label: "Front Office", color: "#2563eb" },
            { label: "Housekeeping", color: "#d03030" },
            { label: "IRD", color: "#2d6a4f" },
            { label: "Restaurante", color: "#e07020" },
            { label: "Spa", color: "#8b5cf6" },
            { label: "Reservas", color: "#0891b2" },
            { label: "Pool", color: "#ca8a04" },
          ].map((a) => (
            <div key={a.label} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">{a.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Rankings */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Card radius={18} padding={14}>
          <div className="text-[12px] font-black text-[var(--text)]">Top 3 mejor performance</div>
          <div className="mt-2 space-y-2">
            {[
              { area: "Spa", score: "96.0%", tone: "ok" as Tone },
              { area: "Restaurante", score: "94.0%", tone: "ok" as Tone },
              { area: "Pool", score: "91.0%", tone: "ok" as Tone },
            ].map((r) => (
              <div key={r.area} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}>
                <span className="text-[11px] font-black text-[var(--text)]">{r.area}</span>
                <span className="text-[14px] font-black" style={{ color: r.tone === "ok" ? "#2d6a4f" : r.tone === "warn" ? "#b45309" : "#dc2626" }}>{r.score}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card radius={18} padding={14}>
          <div className="text-[12px] font-black text-[var(--text)]">Top 3 peor performance</div>
          <div className="mt-2 space-y-2">
            {[
              { area: "Reservas", score: "86.0%", tone: "warn" as Tone },
              { area: "Housekeeping", score: "87.0%", tone: "warn" as Tone },
              { area: "Front Office", score: "88.0%", tone: "warn" as Tone },
            ].map((r) => (
              <div key={r.area} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}>
                <span className="text-[11px] font-black text-[var(--text)]">{r.area}</span>
                <span className="text-[14px] font-black" style={{ color: r.tone === "ok" ? "#2d6a4f" : r.tone === "warn" ? "#b45309" : "#dc2626" }}>{r.score}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Worst audits */}
      <Card radius={18} padding={14} className="mt-3">
        <div className="text-[12px] font-black text-[var(--text)]">Top 3 peores auditorias</div>
        <div className="mt-2 space-y-2">
          {[
            { name: "Housekeeping — Evening Service", score: "43.8%" },
            { name: "Front Office — Night Audit", score: "50.0%" },
            { name: "Housekeeping — Daily Service", score: "52.8%" },
          ].map((a) => (
            <div key={a.name} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}>
              <span className="text-[10px] font-black text-[var(--text)]">{a.name}</span>
              <span className="text-[14px] font-black text-[#dc2626]">{a.score}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ProductOperationsMock() {
  return (
    <div
      className="overflow-hidden rounded-[28px] p-3 sm:p-4"
      style={{
        background: "rgba(255,255,255,0.55)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div
        className="rounded-[22px] px-4 py-3"
        style={{
          background: "var(--header-bg)",
          border: "1px solid var(--header-border)",
          boxShadow: "var(--header-shadow)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              Equipo
            </div>
            <div className="mt-1 text-[20px] font-black leading-none text-[var(--text)]">
              Recuperacion y seguimiento
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill label="General" />
            <StatusPill label="Recuperacion" tone="warn" />
            <StatusPill label="Formaciones" />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <MiniMetric label="Total" value="18" />
        <MiniMetric label="Pendiente" value="05" tone="warn" />
        <MiniMetric label="Bloqueadas" value="03" tone="danger" />
        <MiniMetric label="Listas" value="10" tone="ok" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card radius={18} padding={16}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[13px] font-extrabold text-[var(--text-secondary)]">
              Reauditorias activas
            </div>
            <StatusPill label="Programadas hoy" tone="warn" />
          </div>

          <div className="mt-4 space-y-3">
            {[
              {
                title: "Guest Room Deluxe",
                area: "Housekeeping",
                status: "Formacion pendiente",
                tone: "warn" as Tone,
              },
              {
                title: "Front Desk Opening",
                area: "Recepcion",
                status: "Lista",
                tone: "ok" as Tone,
              },
              {
                title: "Cold Kitchen Setup",
                area: "Cocina fria",
                status: "Bloqueada",
                tone: "danger" as Tone,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl px-4 py-4"
                style={{
                  background: "var(--row-bg)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-black text-[var(--text)]">{item.title}</div>
                    <div className="mt-1 text-[12px] font-bold text-[var(--text-secondary)]">
                      {item.area} · Programada 09:30
                    </div>
                  </div>
                  <StatusPill label={item.status} tone={item.tone} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-4">
          <Card radius={18} padding={16}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[13px] font-extrabold text-[var(--text-secondary)]">
                Formacion vinculada
              </div>
              <StatusPill label="2 sesiones" tone="quality" />
            </div>
            <div className="mt-4 space-y-3">
              {[
                "Liberacion de habitacion y evidencia fotografica",
                "Checklist de apertura Front Desk",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl px-4 py-3 text-[13px] font-black text-[var(--text)]"
                  style={{
                    background: "var(--quality-bg-child)",
                    border: "1px solid var(--quality-border)",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </Card>

          <Card radius={18} padding={16}>
            <div className="text-[13px] font-extrabold text-[var(--text-secondary)]">
              Backlog correctivo
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "var(--row-bg)" }}>
                <span className="text-[13px] font-black text-[var(--text)]">IT · Sensor minibar</span>
                <StatusPill label="Open" tone="danger" />
              </div>
              <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "var(--row-bg)" }}>
                <span className="text-[13px] font-black text-[var(--text)]">Engineering · Puerta 301</span>
                <StatusPill label="In Progress" tone="warn" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
