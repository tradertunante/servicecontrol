"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/types";

type ReauditRow = {
  id: string;
  hotel_id: string;
  area_id: string;
  audit_template_id: string;
  team_member_id: string | null;
  assigned_auditor_id: string | null;
  parent_audit_run_id: string | null;
  status: string | null;
  score: number | null;
  scheduled_for: string | null;
  requires_training: boolean | null;
  training_confirmed: boolean | null;
  ready_for_reaudit: boolean | null;
  blocking_issue_count: number | null;
  origin_type: string | null;
  notes: string | null;
  executed_at: string | null;
};

type AreaRow = { id: string; name: string; type: string | null };
type TemplateRow = { id: string; name: string };
type TeamMemberRow = { id: string; full_name: string };
type ProfileLite = { id: string; full_name: string | null };

type EnrichedReauditRow = ReauditRow & {
  area_name: string | null;
  area_type: string | null;
  template_name: string | null;
  team_member_name: string | null;
  assigned_auditor_name: string | null;
};

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

function dayDiffFromNow(iso: string | null) {
  if (!iso) return null;
  const now = Date.now();
  const target = new Date(iso).getTime();
  return Math.floor((target - now) / (1000 * 60 * 60 * 24));
}

export default function ReauditsPanel({
  profile,
  hotelId,
}: {
  profile: Profile | null;
  hotelId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<EnrichedReauditRow[]>([]);

  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending_training" | "blocked_by_non_operational" | "draft"
  >("all");
  const [q, setQ] = useState("");

  const activeHotelId = hotelId || profile?.hotel_id || null;

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      if (!activeHotelId) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data, error: runsErr } = await supabase
        .from("audit_runs")
        .select(
          "id,hotel_id,area_id,audit_template_id,team_member_id,assigned_auditor_id,parent_audit_run_id,status,score,scheduled_for,requires_training,training_confirmed,ready_for_reaudit,blocking_issue_count,origin_type,notes,executed_at"
        )
        .eq("hotel_id", activeHotelId)
        .eq("is_reaudit", true)
        .order("scheduled_for", { ascending: true, nullsFirst: false });

      if (runsErr) throw runsErr;

      const baseRows = (data ?? []) as ReauditRow[];

      const areaIds = Array.from(new Set(baseRows.map((x) => x.area_id).filter(Boolean)));
      const templateIds = Array.from(
        new Set(baseRows.map((x) => x.audit_template_id).filter(Boolean))
      );
      const teamMemberIds = Array.from(
        new Set(baseRows.map((x) => x.team_member_id).filter(Boolean))
      ) as string[];
      const auditorIds = Array.from(
        new Set(baseRows.map((x) => x.assigned_auditor_id).filter(Boolean))
      ) as string[];

      const [areasRes, templatesRes, teamRes, auditorRes] = await Promise.all([
        areaIds.length
          ? supabase.from("areas").select("id,name,type").in("id", areaIds)
          : Promise.resolve({ data: [] as AreaRow[], error: null }),
        templateIds.length
          ? supabase.from("audit_templates").select("id,name").in("id", templateIds)
          : Promise.resolve({ data: [] as TemplateRow[], error: null }),
        teamMemberIds.length
          ? supabase.from("team_members").select("id,full_name").in("id", teamMemberIds)
          : Promise.resolve({ data: [] as TeamMemberRow[], error: null }),
        auditorIds.length
          ? supabase.from("profiles").select("id,full_name").in("id", auditorIds)
          : Promise.resolve({ data: [] as ProfileLite[], error: null }),
      ]);

      if (areasRes.error) throw areasRes.error;
      if (templatesRes.error) throw templatesRes.error;
      if (teamRes.error) throw teamRes.error;
      if (auditorRes.error) throw auditorRes.error;

      const areaMap = new Map<string, AreaRow>();
      for (const a of (areasRes.data ?? []) as AreaRow[]) areaMap.set(a.id, a);

      const templateMap = new Map<string, string>();
      for (const t of (templatesRes.data ?? []) as TemplateRow[]) templateMap.set(t.id, t.name);

      const teamMap = new Map<string, string>();
      for (const tm of (teamRes.data ?? []) as TeamMemberRow[]) teamMap.set(tm.id, tm.full_name);

      const auditorMap = new Map<string, string | null>();
      for (const p of (auditorRes.data ?? []) as ProfileLite[]) auditorMap.set(p.id, p.full_name ?? null);

      const enriched: EnrichedReauditRow[] = baseRows.map((row) => ({
        ...row,
        area_name: areaMap.get(row.area_id)?.name ?? null,
        area_type: areaMap.get(row.area_id)?.type ?? null,
        template_name: templateMap.get(row.audit_template_id) ?? null,
        team_member_name: row.team_member_id ? teamMap.get(row.team_member_id) ?? null : null,
        assigned_auditor_name: row.assigned_auditor_id
          ? auditorMap.get(row.assigned_auditor_id) ?? null
          : null,
      }));

      setRows(enriched);
      setLoading(false);
    } catch (e: any) {
      setError(e?.message || "Error cargando re-auditorías.");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeHotelId]);

  const filtered = useMemo(() => {
    let list = [...rows];

    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }

    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((r) =>
        [
          r.area_name ?? "",
          r.area_type ?? "",
          r.template_name ?? "",
          r.team_member_name ?? "",
          r.assigned_auditor_name ?? "",
          r.status ?? "",
          r.origin_type ?? "",
          r.notes ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      );
    }

    return list;
  }, [rows, statusFilter, q]);

  const stats = useMemo(() => {
    let pendingTraining = 0;
    let blocked = 0;
    let ready = 0;

    for (const r of rows) {
      if (r.status === "pending_training") pendingTraining += 1;
      if (r.status === "blocked_by_non_operational") blocked += 1;
      if (r.ready_for_reaudit) ready += 1;
    }

    return {
      total: rows.length,
      pendingTraining,
      blocked,
      ready,
    };
  }, [rows]);

  async function confirmTraining(row: EnrichedReauditRow) {
    setSavingId(row.id);
    setError("");
    setMessage("");

    try {
      const blockingIssueCount = Number(row.blocking_issue_count ?? 0);
      const nextReady = blockingIssueCount === 0;

      const nextStatus = nextReady ? "draft" : "blocked_by_non_operational";

      const { error: updateErr } = await supabase
        .from("audit_runs")
        .update({
          training_confirmed: true,
          blocking_issue_count: blockingIssueCount,
          ready_for_reaudit: nextReady,
          status: nextStatus,
        })
        .eq("id", row.id);

      if (updateErr) throw updateErr;

      setMessage(
        nextReady
          ? "Training confirmado. La re-auditoría ya está lista para ejecutarse."
          : "Training confirmado. La re-auditoría sigue bloqueada por incidencias no operativas."
      );

      await loadData();
    } catch (e: any) {
      setError(e?.message || "No se pudo confirmar el training.");
    } finally {
      setSavingId(null);
    }
  }

  const btn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card-bg)",
    fontWeight: 900,
    cursor: "pointer",
  };

  const primaryBtn: React.CSSProperties = {
    ...btn,
    background: "black",
    color: "white",
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {[
          { label: "Total Re-audits", value: stats.total },
          { label: "Pending Training", value: stats.pendingTraining },
          { label: "Blocked", value: stats.blocked },
          { label: "Ready", value: stats.ready },
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
            <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 800 }}>{item.label}</div>
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
          placeholder="Buscar área, template, colaborador, auditor..."
          style={{
            flex: 1,
            minWidth: 260,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--card-bg)",
          }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={btn}
        >
          <option value="all">Todos los estados</option>
          <option value="pending_training">pending_training</option>
          <option value="blocked_by_non_operational">blocked_by_non_operational</option>
          <option value="draft">ready_for_reaudit</option>
        </select>

        <button onClick={loadData} style={btn}>
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
            border: "1px solid var(--border)",
            background: "rgba(0,200,0,0.10)",
            color: "green",
            fontWeight: 900,
          }}
        >
          {message}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {loading ? (
          <div style={{ fontWeight: 900 }}>Cargando re-auditorías…</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 18,
            }}
          >
            <div style={{ fontWeight: 900 }}>No hay re-auditorías</div>
            <div style={{ marginTop: 6, color: "var(--muted)" }}>
              No hay registros para los filtros actuales.
            </div>
          </div>
        ) : (
          filtered.map((row) => {
            const daysToDue = dayDiffFromNow(row.scheduled_for);
            const isOverdue = daysToDue !== null && daysToDue < 0;
            const isReady = !!row.ready_for_reaudit;
            const canConfirmTraining =
              row.status === "pending_training" &&
              row.requires_training === true &&
              row.training_confirmed !== true;

            const busy = savingId === row.id;

            return (
              <div
                key={row.id}
                style={{
                  background: "var(--card-bg)",
                  border: isReady
                    ? "1px solid rgba(0,200,0,0.30)"
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
                          row.status === "draft"
                            ? "rgba(0,200,0,0.10)"
                            : row.status === "pending_training"
                              ? "rgba(255,180,0,0.12)"
                              : "rgba(220,0,0,0.06)",
                        color:
                          row.status === "draft"
                            ? "green"
                            : row.status === "pending_training"
                              ? "#9a6700"
                              : "crimson",
                      }}
                    >
                      {row.status ?? "—"}
                    </span>

                    {isReady ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          padding: "5px 9px",
                          borderRadius: 999,
                          border: "1px solid rgba(0,200,0,0.2)",
                          background: "rgba(0,200,0,0.08)",
                          color: "green",
                        }}
                      >
                        READY
                      </span>
                    ) : null}

                    {isOverdue ? (
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
                        OVERDUE
                      </span>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                    Programada: {fmtDate(row.scheduled_for)}
                    {daysToDue !== null ? ` · ${Math.abs(daysToDue)} ${daysToDue < 0 ? "días tarde" : "días"}` : ""}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    {row.template_name ?? "Re-auditoría"}
                  </div>

                  <div style={{ opacity: 0.9 }}>
                    {row.area_name ?? "—"} {row.area_type ? `· ${row.area_type}` : ""}
                  </div>

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
                        Auditor asignado
                      </div>
                      <div>{row.assigned_auditor_name ?? "—"}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                        Training
                      </div>
                      <div>
                        {row.requires_training
                          ? row.training_confirmed
                            ? "confirmado"
                            : "pendiente"
                          : "no requerido"}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                        Blocking issues
                      </div>
                      <div>{row.blocking_issue_count ?? 0}</div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                      Auditoría origen
                    </div>
                    <div>{row.parent_audit_run_id ?? "—"}</div>
                  </div>

                  {row.notes ? (
                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                        Notes
                      </div>
                      <div>{row.notes}</div>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {canConfirmTraining ? (
                    <button
                      disabled={busy}
                      onClick={() => confirmTraining(row)}
                      style={{
                        ...primaryBtn,
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      {busy ? "Confirmando..." : "Confirm Training"}
                    </button>
                  ) : null}

                  {isReady ? (
                    <div
                      style={{
                        ...btn,
                        cursor: "default",
                        background: "rgba(0,200,0,0.08)",
                        color: "green",
                        border: "1px solid rgba(0,200,0,0.2)",
                      }}
                    >
                      Lista para re-auditar
                    </div>
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