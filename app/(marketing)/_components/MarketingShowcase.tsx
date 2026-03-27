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

        <div className="flex flex-wrap gap-2">
          <StatusPill label="General" />
          <StatusPill label="Quality" tone="quality" />
          <StatusPill label="Hoy" />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <MiniMetric label="Score global" value="91.4%" />
        <MiniMetric label="Hallazgos" value="06" tone="danger" />
        <MiniMetric label="Reauditorias" value="14" tone="warn" />
        <MiniMetric label="Listas" value="09" tone="ok" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card radius={18} padding={16}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-extrabold text-[var(--text-secondary)]">
                Ranking por area
              </div>
              <div className="mt-1 text-[19px] font-black text-[var(--text)]">
                Vista operativa del hotel
              </div>
            </div>
            <StatusPill label="12 auditorias" />
          </div>

          <div className="mt-4 space-y-3">
            <RankingRow
              area="Housekeeping"
              score="84.0%"
              note="3 hallazgos abiertos · ver detalle"
              tone="danger"
            />
            <RankingRow
              area="Recepcion"
              score="88.6%"
              note="1 reauditoria pendiente"
              tone="warn"
            />
            <RankingRow
              area="Spa"
              score="96.2%"
              note="Operacion estable"
              tone="ok"
            />
          </div>
        </Card>

        <div className="grid gap-4">
          <Card radius={18} padding={16}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[13px] font-extrabold text-[var(--text-secondary)]">
                Seguimiento correctivo
              </div>
              <StatusPill label="Bloquea reauditoria" tone="danger" />
            </div>
            <div className="mt-3 text-[17px] font-black leading-6 text-[var(--text)]">
              Mise en place incompleto en buffet desayuno
            </div>
            <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
              Responsable: Supervisor A&B. Estado: en progreso. Reauditoria prevista en 24 horas.
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl px-3 py-3" style={{ background: "var(--row-bg)" }}>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  Departamento
                </div>
                <div className="mt-2 text-[13px] font-black text-[var(--text)]">Alimentos y bebidas</div>
              </div>
              <div className="rounded-2xl px-3 py-3" style={{ background: "var(--row-bg)" }}>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  Prioridad
                </div>
                <div className="mt-2">
                  <StatusPill label="En progreso" tone="warn" />
                </div>
              </div>
            </div>
          </Card>

          <Card radius={18} padding={16}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[13px] font-extrabold text-[var(--text-secondary)]">
                Tendencia 12 meses
              </div>
              <StatusPill label="Ultima actualizacion" tone="ok" />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <ProgressRow label="Housekeeping" value="84%" width="84%" />
              <ProgressRow label="Front Desk" value="89%" width="89%" />
              <ProgressRow label="Cocina" value="93%" width="93%" />
            </div>
          </Card>
        </div>
      </div>
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
