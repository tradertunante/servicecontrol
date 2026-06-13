"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/types";

type ActionStatus = "open" | "in_progress" | "resolved";

type InboxRow = {
  id: string;
  hotel_id: string;
  area_id: string;
  area_name: string | null;
  audit_run_id: string;
  reaudit_run_id: string | null;
  team_member_id: string | null;
  team_member_name: string | null;
  assigned_department: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  status: ActionStatus;
  title: string;
  description: string | null;
  evidence_note: string | null;
  opened_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  blocks_reaudit: boolean;
  due_date: string | null;
};

type HotelProfile = {
  id: string;
  full_name: string | null;
  role: string;
};

function daysOpen(openedAt: string, resolvedAt?: string | null) {
  const start = new Date(openedAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

function isOverdue(dueDate: string | null, status: ActionStatus) {
  if (!dueDate || status === "resolved") return false;
  return new Date(dueDate).getTime() < Date.now();
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

const STATUS_COLORS: Record<ActionStatus, { bg: string; color: string }> = {
  open:        { bg: "rgba(220,0,0,0.06)",   color: "crimson" },
  in_progress: { bg: "rgba(255,180,0,0.12)", color: "#9a6700" },
  resolved:    { bg: "rgba(0,200,0,0.10)",   color: "green" },
};

const STATUS_LABELS: Record<ActionStatus, string> = {
  open:        "Pendiente",
  in_progress: "En progreso",
  resolved:    "Resuelto",
};

const DEPT_LABELS: Record<string, string> = {
  engineering: "Engineering",
  systems:     "Sistemas",
  it:          "IT",
};

export default function CorrectiveActionsInbox({
  profile,
  hotelId,
}: {
  profile: Profile | null;
  hotelId: string;
}) {
  const t = useTranslations("app.corrective");

  const [loading, setLoading]         = useState(true);
  const [rows, setRows]               = useState<InboxRow[]>([]);
  const [hotelProfiles, setProfiles]  = useState<HotelProfile[]>([]);
  const [savingId, setSavingId]       = useState<string | null>(null);
  const [error, setError]             = useState("");
  const [message, setMessage]         = useState("");

  // Filters
  const [q, setQ]                     = useState("");
  const [statusFilter, setStatus]     = useState<"all" | ActionStatus>("open");
  const [deptFilter, setDept]         = useState<"all" | string>("all");
  const [areaFilter, setArea]         = useState<"all" | string>("all");
  const [blockingOnly, setBlocking]   = useState(false);

  const role = profile?.role ?? null;
  const canManage = ["superadmin", "admin", "general_manager", "manager", "quality"].includes(role ?? "");

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error("Sesión inválida.");
    return token;
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const token = await getToken();
      const res = await fetch("/api/corrective-actions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Error cargando datos.");
      setRows((payload?.actions ?? []) as InboxRow[]);
      setProfiles((payload?.hotelProfiles ?? []) as HotelProfile[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando datos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived filter lists
  const areas = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) if (r.area_id && r.area_name) map.set(r.area_id, r.area_name);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const depts = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.assigned_department))).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (deptFilter !== "all")   list = list.filter((r) => r.assigned_department === deptFilter);
    if (areaFilter !== "all")   list = list.filter((r) => r.area_id === areaFilter);
    if (blockingOnly)           list = list.filter((r) => r.blocks_reaudit);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((r) =>
        [r.title, r.area_name ?? "", r.assigned_to_name ?? "", r.team_member_name ?? "", r.assigned_department, r.description ?? ""]
          .join(" ").toLowerCase().includes(needle)
      );
    }
    return list;
  }, [rows, statusFilter, deptFilter, areaFilter, blockingOnly, q]);

  const stats = useMemo(() => {
    let open = 0, inProgress = 0, resolved = 0, blocking = 0, overdue = 0;
    for (const r of rows) {
      if (r.status === "open") open++;
      if (r.status === "in_progress") inProgress++;
      if (r.status === "resolved") resolved++;
      if (r.blocks_reaudit && r.status !== "resolved") blocking++;
      if (isOverdue(r.due_date, r.status)) overdue++;
    }
    return { open, inProgress, resolved, blocking, overdue };
  }, [rows]);

  async function setActionStatus(row: InboxRow, nextStatus: ActionStatus) {
    if (!canManage) return;
    setSavingId(row.id);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/corrective-actions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action_id: row.id, status: nextStatus }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo actualizar.");
      setMessage(
        nextStatus === "resolved" ? t("msgResolved") :
        nextStatus === "in_progress" ? t("msgInProgress") : t("msgReopened")
      );
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setSavingId(null);
    }
  }

  async function patchAction(actionId: string, patch: { due_date?: string | null; assigned_to?: string | null }) {
    if (!canManage) return;
    setSavingId(actionId);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/corrective-actions/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action_id: actionId, ...patch }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo guardar.");
      // Optimistic update
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== actionId) return r;
          const next = { ...r };
          if ("due_date" in patch) next.due_date = patch.due_date ?? null;
          if ("assigned_to" in patch) {
            next.assigned_to = patch.assigned_to ?? null;
            next.assigned_to_name = patch.assigned_to
              ? (hotelProfiles.find((p) => p.id === patch.assigned_to)?.full_name ?? null)
              : null;
          }
          return next;
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setSavingId(null);
    }
  }

  // --- Render helpers ---
  const cardStyle: React.CSSProperties = {
    background: "var(--card-bg)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 14,
  };

  const btnBase: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card-bg)",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  };

  const selectStyle: React.CSSProperties = {
    ...btnBase,
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    paddingRight: 28,
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 950, margin: 0 }}>{t("title")}</h1>
        <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 700 }}>{t("subtitle")}</span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {[
          { label: t("statOpen"),       value: stats.open,       color: "crimson",  clickStatus: "open" as const },
          { label: t("statInProgress"), value: stats.inProgress, color: "#9a6700",  clickStatus: "in_progress" as const },
          { label: t("statResolved"),   value: stats.resolved,   color: "green",    clickStatus: "resolved" as const },
          { label: t("statBlocking"),   value: stats.blocking,   color: "crimson",  clickStatus: null },
          { label: t("statOverdue"),    value: stats.overdue,    color: "#b84000",  clickStatus: null },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => { if (s.clickStatus) setStatus(s.clickStatus === statusFilter ? "all" : s.clickStatus); }}
            style={{
              ...cardStyle,
              cursor: s.clickStatus ? "pointer" : "default",
              textAlign: "left",
              padding: "14px 16px",
              boxShadow: "var(--shadow-sm)",
              outline: s.clickStatus && statusFilter === s.clickStatus ? `2px solid ${s.color}` : undefined,
            }}
          >
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>{s.label}</div>
            <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950, color: s.value > 0 ? s.color : undefined }}>
              {s.value}
            </div>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ ...cardStyle, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          style={{ flex: 1, minWidth: 200, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card-bg)", fontSize: 13 }}
        />

        <select value={statusFilter} onChange={(e) => setStatus(e.target.value as "all" | ActionStatus)} style={selectStyle}>
          <option value="all">{t("allStatuses")}</option>
          <option value="open">{t("statusOpen")}</option>
          <option value="in_progress">{t("statusInProgress")}</option>
          <option value="resolved">{t("statusResolved")}</option>
        </select>

        {areas.length > 1 && (
          <select value={areaFilter} onChange={(e) => setArea(e.target.value)} style={selectStyle}>
            <option value="all">{t("allAreas")}</option>
            {areas.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        )}

        {depts.length > 1 && (
          <select value={deptFilter} onChange={(e) => setDept(e.target.value)} style={selectStyle}>
            <option value="all">{t("allDepts")}</option>
            {depts.map((d) => (
              <option key={d} value={d}>{DEPT_LABELS[d] ?? d}</option>
            ))}
          </select>
        )}

        <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={blockingOnly} onChange={(e) => setBlocking(e.target.checked)} />
          {t("blockingOnly")}
        </label>

        <button onClick={loadData} style={{ ...btnBase, marginLeft: "auto" }} disabled={loading}>
          {loading ? t("loading") : t("reload")}
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(220,0,0,0.3)", background: "rgba(220,0,0,0.06)", color: "crimson", fontWeight: 900 }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(0,200,0,0.25)", background: "rgba(0,200,0,0.07)", color: "green", fontWeight: 900 }}>
          {message}
        </div>
      )}

      {/* Results count */}
      {!loading && (
        <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 700 }}>
          {t("showing", { count: filtered.length, total: rows.length })}
        </div>
      )}

      {/* List */}
      <div style={{ display: "grid", gap: 10 }}>
        {loading ? (
          <div style={{ ...cardStyle, padding: 24, fontWeight: 900, color: "var(--muted)" }}>{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <div style={{ ...cardStyle, padding: 24 }}>
            <div style={{ fontWeight: 900 }}>{t("empty")}</div>
            <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>{t("emptyDesc")}</div>
          </div>
        ) : filtered.map((row) => {
          const busy      = savingId === row.id;
          const days      = daysOpen(row.opened_at, row.resolved_at);
          const overdue   = isOverdue(row.due_date, row.status);
          const stColor   = STATUS_COLORS[row.status];

          return (
            <div
              key={row.id}
              style={{
                ...cardStyle,
                border: row.blocks_reaudit && row.status !== "resolved"
                  ? "1px solid rgba(220,0,0,0.22)"
                  : "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
                display: "grid",
                gap: 14,
                opacity: busy ? 0.7 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {/* Top row: badges + days */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {/* Status badge */}
                  <span style={{
                    fontSize: 11, fontWeight: 900, padding: "4px 8px", borderRadius: 999,
                    background: stColor.bg, color: stColor.color, border: `1px solid ${stColor.color}30`,
                  }}>
                    {STATUS_LABELS[row.status]}
                  </span>

                  {/* Department */}
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 8px", borderRadius: 999, border: "1px solid var(--border)", background: "rgba(255,255,255,0.04)" }}>
                    {DEPT_LABELS[row.assigned_department] ?? row.assigned_department}
                  </span>

                  {/* Blocking badge */}
                  {row.blocks_reaudit && row.status !== "resolved" && (
                    <span style={{ fontSize: 11, fontWeight: 900, padding: "4px 8px", borderRadius: 999, background: "rgba(220,0,0,0.07)", color: "crimson", border: "1px solid rgba(220,0,0,0.2)" }}>
                      {t("blocksReaudit")}
                    </span>
                  )}

                  {/* Overdue */}
                  {overdue && (
                    <span style={{ fontSize: 11, fontWeight: 900, padding: "4px 8px", borderRadius: 999, background: "rgba(184,64,0,0.09)", color: "#b84000", border: "1px solid rgba(184,64,0,0.22)" }}>
                      {t("overdue")}
                    </span>
                  )}
                </div>

                <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, flexShrink: 0 }}>
                  {t("openDays", { days })}
                </span>
              </div>

              {/* Title */}
              <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.35 }}>{row.title}</div>

              {/* Meta grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>

                {/* Área */}
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 800, marginBottom: 3 }}>{t("fieldArea")}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{row.area_name ?? "—"}</div>
                </div>

                {/* Colaborador auditado */}
                {row.team_member_name && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 800, marginBottom: 3 }}>{t("fieldCollaborator")}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{row.team_member_name}</div>
                  </div>
                )}

                {/* Responsable asignado — editable inline */}
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 800, marginBottom: 3 }}>{t("fieldAssignedTo")}</div>
                  {canManage ? (
                    <select
                      disabled={busy}
                      value={row.assigned_to ?? ""}
                      onChange={(e) => patchAction(row.id, { assigned_to: e.target.value || null })}
                      style={{ ...selectStyle, padding: "6px 28px 6px 8px", fontSize: 13, width: "100%", maxWidth: 200 }}
                    >
                      <option value="">{t("unassigned")}</option>
                      {hotelProfiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name ?? p.id}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{row.assigned_to_name ?? t("unassigned")}</div>
                  )}
                </div>

                {/* Fecha límite — editable inline */}
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 800, marginBottom: 3 }}>{t("fieldDueDate")}</div>
                  {canManage ? (
                    <input
                      type="date"
                      disabled={busy}
                      value={toDateInputValue(row.due_date)}
                      onChange={(e) => patchAction(row.id, { due_date: e.target.value ? `${e.target.value}T23:59:59Z` : null })}
                      style={{ ...btnBase, padding: "6px 8px", fontSize: 13, width: "100%", maxWidth: 160, color: overdue ? "#b84000" : undefined }}
                    />
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 700, color: overdue ? "#b84000" : undefined }}>
                      {fmtDate(row.due_date)}
                    </div>
                  )}
                </div>

                {/* Abierta */}
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 800, marginBottom: 3 }}>{t("fieldOpened")}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtDate(row.opened_at)}</div>
                </div>

                {/* Resuelta por */}
                {row.resolved_at && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 800, marginBottom: 3 }}>{t("fieldResolvedBy")}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{row.resolved_by_name ?? "—"}</div>
                  </div>
                )}
              </div>

              {/* Evidence note */}
              {row.evidence_note && (
                <div style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic", borderLeft: "3px solid var(--border)", paddingLeft: 10 }}>
                  {row.evidence_note}
                </div>
              )}

              {/* Action buttons */}
              {canManage && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 2 }}>
                  {row.status !== "open" && (
                    <button disabled={busy} onClick={() => setActionStatus(row, "open")} style={{ ...btnBase }}>
                      {t("reopen")}
                    </button>
                  )}
                  {row.status !== "in_progress" && (
                    <button disabled={busy} onClick={() => setActionStatus(row, "in_progress")} style={{ ...btnBase }}>
                      {t("markInProgress")}
                    </button>
                  )}
                  {row.status !== "resolved" && (
                    <button
                      disabled={busy}
                      onClick={() => setActionStatus(row, "resolved")}
                      style={{ ...btnBase, background: "#0a0a0a", color: "#fff", borderColor: "#0a0a0a" }}
                    >
                      {busy ? t("saving") : t("markResolved")}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}