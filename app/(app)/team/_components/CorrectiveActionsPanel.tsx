"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Profile, Role } from "@/lib/types";

type CorrectiveActionRow = {
  id: string;
  hotel_id: string;
  area_id: string;
  audit_run_id: string;
  reaudit_run_id: string | null;
  question_id: string;
  team_member_id: string | null;
  assigned_department: "engineering" | "systems";
  status: "open" | "in_progress" | "resolved";
  title: string;
  description: string | null;
  evidence_note: string | null;
  evidence_photo_path: string | null;
  opened_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  blocks_reaudit: boolean;
};

type AreaRow = { id: string; name: string };
type TeamMemberRow = { id: string; full_name: string };
type ProfileLite = { id: string; full_name: string | null };

type EnrichedRow = CorrectiveActionRow & {
  area_name: string | null;
  team_member_name: string | null;
  resolved_by_name: string | null;
};

function daysOpen(openedAt: string, resolvedAt?: string | null) {
  const start = new Date(openedAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CorrectiveActionsPanel({
  profile,
  hotelId,
}: {
  profile: Profile | null;
  hotelId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const [rows, setRows] = useState<EnrichedRow[]>([]);

  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState<"all" | "engineering" | "systems">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_progress" | "resolved">(
    "all"
  );
  const [blockingOnly, setBlockingOnly] = useState(false);

  const activeHotelId = hotelId || profile?.hotel_id || null;
  const role = profile?.role ?? null;

  const canSeeAll =
    role === "admin" || role === "manager" || role === "quality" || role === "superadmin";

  const forcedDepartment =
    role === "engineering" ? "engineering" : role === "systems" ? "systems" : null;

  async function loadData() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (!activeHotelId) {
        setRows([]);
        setLoading(false);
        return;
      }

      let actionsQuery = supabase
        .from("audit_corrective_actions")
        .select(
          "id,hotel_id,area_id,audit_run_id,reaudit_run_id,question_id,team_member_id,assigned_department,status,title,description,evidence_note,evidence_photo_path,opened_at,resolved_at,resolved_by,blocks_reaudit"
        )
        .eq("hotel_id", activeHotelId)
        .order("opened_at", { ascending: false });

      if (forcedDepartment) {
        actionsQuery = actionsQuery.eq("assigned_department", forcedDepartment);
      }

      const { data: actionsData, error: actionsErr } = await actionsQuery;
      if (actionsErr) throw actionsErr;

      const actions = (actionsData ?? []) as CorrectiveActionRow[];

      const areaIds = Array.from(new Set(actions.map((x) => x.area_id).filter(Boolean)));
      const teamMemberIds = Array.from(
        new Set(actions.map((x) => x.team_member_id).filter(Boolean))
      ) as string[];
      const resolvedByIds = Array.from(
        new Set(actions.map((x) => x.resolved_by).filter(Boolean))
      ) as string[];

      const [areasRes, teamRes, profRes] = await Promise.all([
        areaIds.length
          ? supabase.from("areas").select("id,name").in("id", areaIds)
          : Promise.resolve({ data: [] as AreaRow[], error: null }),
        teamMemberIds.length
          ? supabase.from("team_members").select("id,full_name").in("id", teamMemberIds)
          : Promise.resolve({ data: [] as TeamMemberRow[], error: null }),
        resolvedByIds.length
          ? supabase.from("profiles").select("id,full_name").in("id", resolvedByIds)
          : Promise.resolve({ data: [] as ProfileLite[], error: null }),
      ]);

      if (areasRes.error) throw areasRes.error;
      if (teamRes.error) throw teamRes.error;
      if (profRes.error) throw profRes.error;

      const areaMap = new Map<string, string>();
      for (const a of (areasRes.data ?? []) as AreaRow[]) areaMap.set(a.id, a.name);

      const teamMap = new Map<string, string>();
      for (const tm of (teamRes.data ?? []) as TeamMemberRow[]) teamMap.set(tm.id, tm.full_name);

      const profileMap = new Map<string, string | null>();
      for (const p of (profRes.data ?? []) as ProfileLite[]) {
        profileMap.set(p.id, p.full_name ?? null);
      }

      const enriched: EnrichedRow[] = actions.map((row) => ({
        ...row,
        area_name: areaMap.get(row.area_id) ?? null,
        team_member_name: row.team_member_id ? teamMap.get(row.team_member_id) ?? null : null,
        resolved_by_name: row.resolved_by ? profileMap.get(row.resolved_by) ?? null : null,
      }));

      setRows(enriched);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setError(e?.message || "Error cargando corrective actions.");
    }
  }

  useEffect(() => {
    loadData();
  }, [activeHotelId, forcedDepartment]);

  const filtered = useMemo(() => {
    let list = [...rows];

    if (!canSeeAll && forcedDepartment) {
      list = list.filter((r) => r.assigned_department === forcedDepartment);
    }

    if (deptFilter !== "all") {
      list = list.filter((r) => r.assigned_department === deptFilter);
    }

    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }

    if (blockingOnly) {
      list = list.filter((r) => r.blocks_reaudit === true);
    }

    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((r) =>
        [
          r.title,
          r.description ?? "",
          r.evidence_note ?? "",
          r.area_name ?? "",
          r.team_member_name ?? "",
          r.assigned_department,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      );
    }

    return list;
  }, [rows, q, deptFilter, statusFilter, blockingOnly, canSeeAll, forcedDepartment]);

  const stats = useMemo(() => {
    let open = 0;
    let inProgress = 0;
    let resolved = 0;
    let blocking = 0;

    for (const r of rows) {
      if (r.status === "open") open += 1;
      if (r.status === "in_progress") inProgress += 1;
      if (r.status === "resolved") resolved += 1;
      if (r.blocks_reaudit) blocking += 1;
    }

    return { open, inProgress, resolved, blocking };
  }, [rows]);

  async function setActionStatus(row: EnrichedRow, nextStatus: "open" | "in_progress" | "resolved") {
    if (!profile?.id) return;
    setSavingId(row.id);
    setError("");
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesión inválida.");

      const response = await fetch("/api/corrective-actions/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action_id: row.id,
          status: nextStatus,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo actualizar la acción.");

      setMessage(
        nextStatus === "resolved"
          ? "Acción marcada como resuelta."
          : nextStatus === "in_progress"
            ? "Acción marcada en progreso."
            : "Acción reabierta."
      );

      await loadData();
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la acción.");
    } finally {
      setSavingId(null);
    }
  }

  const btnBase: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card-bg)",
    fontWeight: 900,
    cursor: "pointer",
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {[
          { label: "Open", value: stats.open },
          { label: "In Progress", value: stats.inProgress },
          { label: "Resolved", value: stats.resolved },
          { label: "Blocking Re-audits", value: stats.blocking },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 16,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 800 }}>
              {item.label}
            </div>
            <div style={{ marginTop: 6, fontSize: 28, fontWeight: 950 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 14,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar título, área, colaborador, nota..."
          style={{
            flex: 1,
            minWidth: 260,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--card-bg)",
          }}
        />

        {canSeeAll ? (
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value as any)}
            style={btnBase}
          >
            <option value="all">Todos los departamentos</option>
            <option value="engineering">engineering</option>
            <option value="systems">systems</option>
          </select>
        ) : null}

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={btnBase}
        >
          <option value="all">Todos los estados</option>
          <option value="open">open</option>
          <option value="in_progress">in_progress</option>
          <option value="resolved">resolved</option>
        </select>

        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--card-bg)",
            fontWeight: 800,
          }}
        >
          <input
            type="checkbox"
            checked={blockingOnly}
            onChange={(e) => setBlockingOnly(e.target.checked)}
          />
          Solo bloqueantes
        </label>

        <button onClick={loadData} style={btnBase}>
          Recargar
        </button>
      </div>

      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(220,0,0,0.35)",
            background: "rgba(220,0,0,0.06)",
            color: "crimson",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(0,200,0,0.25)",
            background: "rgba(0,200,0,0.08)",
            color: "green",
            fontWeight: 900,
          }}
        >
          {message}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {loading ? (
          <div style={{ fontWeight: 900 }}>Cargando corrective actions…</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 18,
            }}
          >
            <div style={{ fontWeight: 900 }}>No hay acciones correctivas</div>
            <div style={{ marginTop: 6, color: "var(--muted)" }}>
              No hay registros para los filtros actuales.
            </div>
          </div>
        ) : (
          filtered.map((row) => {
            const busy = savingId === row.id;
            const openDays = daysOpen(row.opened_at, row.resolved_at);

            return (
              <div
                key={row.id}
                style={{
                  background: "var(--card-bg)",
                  border: row.blocks_reaudit
                    ? "1px solid rgba(220,0,0,0.20)"
                    : "1px solid var(--border)",
                  borderRadius: 16,
                  boxShadow: "var(--shadow-sm)",
                  padding: 16,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        padding: "5px 9px",
                        borderRadius: 999,
                        border: "1px solid var(--border)",
                        background:
                          row.status === "resolved"
                            ? "rgba(0,200,0,0.10)"
                            : row.status === "in_progress"
                              ? "rgba(255,180,0,0.12)"
                              : "rgba(220,0,0,0.06)",
                        color:
                          row.status === "resolved"
                            ? "green"
                            : row.status === "in_progress"
                              ? "#9a6700"
                              : "crimson",
                      }}
                    >
                      {row.status}
                    </span>

                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        padding: "5px 9px",
                        borderRadius: 999,
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.04)",
                      }}
                    >
                      {row.assigned_department}
                    </span>

                    {row.blocks_reaudit ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          padding: "5px 9px",
                          borderRadius: 999,
                          border: "1px solid rgba(220,0,0,0.2)",
                          background: "rgba(220,0,0,0.06)",
                          color: "crimson",
                        }}
                      >
                        BLOCKS RE-AUDIT
                      </span>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                    Open {openDays} día{openDays === 1 ? "" : "s"}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{row.title}</div>

                  <div style={{ opacity: 0.9 }}>{row.area_name ?? "—"}</div>

                  {row.description ? (
                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                        Description
                      </div>
                      <div>{row.description}</div>
                    </div>
                  ) : null}

                  {row.evidence_note ? (
                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                        Evidence note
                      </div>
                      <div>{row.evidence_note}</div>
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                        Colaborador
                      </div>
                      <div>{row.team_member_name ?? "—"}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                        Opened
                      </div>
                      <div>{fmtDate(row.opened_at)}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                        Resolved at
                      </div>
                      <div>{fmtDate(row.resolved_at)}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                        Resolved by
                      </div>
                      <div>{row.resolved_by_name ?? "—"}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {row.status !== "open" ? (
                    <button
                      disabled={busy}
                      onClick={() => setActionStatus(row, "open")}
                      style={{ ...btnBase, opacity: busy ? 0.6 : 1 }}
                    >
                      Reopen
                    </button>
                  ) : null}

                  {row.status !== "in_progress" ? (
                    <button
                      disabled={busy}
                      onClick={() => setActionStatus(row, "in_progress")}
                      style={{ ...btnBase, opacity: busy ? 0.6 : 1 }}
                    >
                      Mark In Progress
                    </button>
                  ) : null}

                  {row.status !== "resolved" ? (
                    <button
                      disabled={busy}
                      onClick={() => setActionStatus(row, "resolved")}
                      style={{
                        ...btnBase,
                        opacity: busy ? 0.6 : 1,
                        background: "black",
                        color: "white",
                      }}
                    >
                      {busy ? "Guardando..." : "Mark Resolved"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
