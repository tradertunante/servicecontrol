"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import type {
  DepartmentActionRow,
  DepartmentCode,
} from "@/hooks/useDepartmentCorrectiveActions";
import { useDepartmentCorrectiveActions } from "@/hooks/useDepartmentCorrectiveActions";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DepartmentMetric({ label, value }: { label: string; value: number }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900 }}>{value}</div>
    </Card>
  );
}

export default function DepartmentCorrectiveActionsPage({
  department,
  title,
  description,
  userId,
}: {
  department: DepartmentCode;
  title: string;
  description: string;
  userId: string;
}) {
  const router = useRouter();
  const { data, error, isLoading } = useDepartmentCorrectiveActions(userId, department);
  const [localRows, setLocalRows] = useState<DepartmentActionRow[]>([]);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [draftsById, setDraftsById] = useState<
    Record<string, { status: string; resolution_comment: string; ready_for_reaudit: boolean }>
  >({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.redirectTo) return;
    router.replace(data.redirectTo);
  }, [data?.redirectTo, router]);

  useEffect(() => {
    setLocalRows(data?.rows ?? []);
  }, [data?.rows]);

  const stats = useMemo(() => {
    return (localRows ?? []).reduce(
      (acc, row) => {
        if (row.status === "open") acc.open += 1;
        else if (row.status === "in_progress") acc.inProgress += 1;
        else if (row.status === "resolved") acc.resolved += 1;
        return acc;
      },
      { open: 0, inProgress: 0, resolved: 0 }
    );
  }, [localRows]);

  const rows = localRows ?? [];
  const scopeLabel = data?.scopeLabel ?? "";
  const userName = data?.userName ?? null;
  const viewMode = data?.viewMode ?? "global";
  const storageMode = data?.storageMode ?? "backlog";
  const warningMessage = data?.warningMessage ?? null;
  const loading = isLoading;
  const errorMessage = error instanceof Error ? error.message : "";
  const departmentLabel = department === "it" ? "IT" : "Engineering";
  const headerContext =
    viewMode === "department"
      ? `Hola, ${userName ?? "—"} · Vista departamental de ${departmentLabel}`
      : `Hola, ${userName ?? "—"} · Vista global de ${departmentLabel}`;
  const resolvedDescription =
    viewMode === "department"
      ? description
      : `Vista global del backlog operativo de ${departmentLabel} en el hotel.`;
  const btnStyle: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "8px 11px",
    background: "var(--card-bg)",
    fontWeight: 800,
    cursor: "pointer",
  };
  const primaryBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: "black",
    color: "white",
    fontWeight: 900,
  };
  const panelStyle: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 12,
    background: "rgba(255,255,255,0.03)",
    padding: 9,
    minWidth: 0,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: "var(--muted)",
    fontWeight: 800,
    lineHeight: 1.2,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  };
  const valueStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.25,
    overflowWrap: "anywhere",
  };

  function getDraft(row: DepartmentActionRow) {
    return (
      draftsById[row.backlog_item_id] ?? {
        status: row.status,
        resolution_comment: row.resolution_comment ?? "",
        ready_for_reaudit: !!row.ready_for_reaudit,
      }
    );
  }

  function updateDraft(
    itemId: string,
    patch: Partial<{ status: string; resolution_comment: string; ready_for_reaudit: boolean }>
  ) {
    setDraftsById((prev) => {
      const current = prev[itemId] ?? { status: "open", resolution_comment: "", ready_for_reaudit: false };
      return {
        ...prev,
        [itemId]: {
          ...current,
          ...patch,
        },
      };
    });
  }

  async function saveItem(row: DepartmentActionRow) {
    const draft = getDraft(row);
    setSavingItemId(row.backlog_item_id);
    setActionError(null);
    setActionInfo(null);

    try {
      const response = await fetch(`/api/departments/backlog/items/${row.backlog_item_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          status: draft.status,
          resolution_comment: draft.resolution_comment,
          ready_for_reaudit: draft.ready_for_reaudit,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string | null;
            item?: {
              id: string;
              status: string;
              resolution_comment: string | null;
              ready_for_reaudit: boolean;
              updated_at: string | null;
            };
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.item) {
        throw new Error(payload?.error ?? "No se pudo actualizar el hallazgo.");
      }

      setLocalRows((prev) =>
        prev.map((entry) =>
          entry.backlog_item_id === row.backlog_item_id
            ? {
                ...entry,
                status: payload.item?.status ?? entry.status,
                resolution_comment: payload.item?.resolution_comment ?? null,
                ready_for_reaudit: payload.item?.ready_for_reaudit ?? false,
                updated_at: payload.item?.updated_at ?? entry.updated_at ?? null,
              }
            : entry
        )
      );

      setDraftsById((prev) => ({
        ...prev,
        [row.backlog_item_id]: {
          status: payload.item?.status ?? draft.status,
          resolution_comment: payload.item?.resolution_comment ?? "",
          ready_for_reaudit: payload.item?.ready_for_reaudit ?? false,
        },
      }));
      setActionInfo("Hallazgo actualizado.");
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : "No se pudo actualizar el hallazgo.");
    } finally {
      setSavingItemId(null);
    }
  }

  function getStatusStyles(status: string): React.CSSProperties {
    if (status === "resolved") {
      return {
        fontSize: 11,
        fontWeight: 900,
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid rgba(0,200,0,0.2)",
        background: "rgba(0,200,0,0.08)",
        color: "green",
      };
    }

    if (status === "in_progress") {
      return {
        fontSize: 11,
        fontWeight: 900,
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,180,0,0.2)",
        background: "rgba(255,180,0,0.12)",
        color: "#9a6700",
      };
    }

    return {
      fontSize: 11,
      fontWeight: 900,
      padding: "4px 8px",
      borderRadius: 999,
      border: "1px solid rgba(220,0,0,0.2)",
      background: "rgba(220,0,0,0.06)",
      color: "crimson",
    };
  }

  return (
    <div style={{ padding: "12px 14px 18px", width: "100%", display: "grid", gap: 16 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
        <div style={{ opacity: 0.85, marginTop: 4 }}>{headerContext}</div>
        <div style={{ opacity: 0.65, marginTop: 4, fontSize: 12 }}>{resolvedDescription}</div>
        {scopeLabel ? (
          <div style={{ opacity: 0.72, marginTop: 4, fontSize: 12, fontWeight: 700 }}>{scopeLabel}</div>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <DepartmentMetric label="Open" value={stats.open} />
        <DepartmentMetric label="In Progress" value={stats.inProgress} />
        <DepartmentMetric label="Resolved" value={stats.resolved} />
      </div>

      {loading ? <Card><div style={{ fontWeight: 900 }}>Cargando backlog operativo…</div></Card> : null}

      {errorMessage ? (
        <Card style={{ border: "1px solid rgba(255,0,0,0.25)", color: "crimson" }}>
          <b>Error:</b> {errorMessage}
        </Card>
      ) : null}

      {warningMessage ? (
        <Card style={{ border: "1px solid rgba(180,120,0,0.25)", color: "#8a5a00", padding: "12px 14px" }}>
          <b>Atención:</b> {warningMessage}
        </Card>
      ) : null}

      {actionError ? (
        <Card style={{ border: "1px solid rgba(255,0,0,0.25)", color: "crimson" }}>
          <b>Error:</b> {actionError}
        </Card>
      ) : null}

      {actionInfo ? (
        <Card style={{ border: "1px solid rgba(0,160,0,0.2)", color: "green" }}>
          <b>OK:</b> {actionInfo}
        </Card>
      ) : null}

      {!loading && !errorMessage && rows.length === 0 ? (
        <Card>
          <div style={{ fontWeight: 900 }}>No hay hallazgos pendientes</div>
          <div style={{ marginTop: 6, opacity: 0.72 }}>
            No hay FAILs submitidos dentro del alcance visible para esta ruta.
          </div>
        </Card>
      ) : null}

      {!loading && !errorMessage ? (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row) => (
            <Card
              key={row.backlog_item_id}
              style={{
                display: "grid",
                gap: 10,
                padding: "12px 14px",
                border:
                  row.ready_for_reaudit
                    ? "1px solid rgba(0,200,0,0.28)"
                    : "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ display: "grid", gap: 6, minWidth: 0, flex: "1 1 540px" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <span style={getStatusStyles(row.status)}>{row.status}</span>
                    {row.ready_for_reaudit ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "1px solid rgba(0,200,0,0.2)",
                          background: "rgba(0,200,0,0.08)",
                          color: "green",
                        }}
                      >
                        LISTO PARA REAUDITORÍA
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 15, lineHeight: 1.15 }}>{row.title}</div>
                </div>

                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      fontWeight: 800,
                      whiteSpace: "normal",
                      textAlign: "right",
                      overflowWrap: "anywhere",
                    }}
                  >
                    Detectado: {fmtDate(row.created_at)}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenItemId((current) => (current === row.backlog_item_id ? null : row.backlog_item_id))
                    }
                    style={btnStyle}
                  >
                    {openItemId === row.backlog_item_id ? "Ocultar detalle" : "Ver detalle"}
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 8,
                }}
              >
                <div style={panelStyle}>
                  <div style={labelStyle}>Área</div>
                  <div style={valueStyle}>{row.area_name ?? "—"}</div>
                </div>

                <div style={panelStyle}>
                  <div style={labelStyle}>Template</div>
                  <div style={valueStyle}>{row.template_name ?? "—"}</div>
                </div>

                <div style={panelStyle}>
                  <div style={labelStyle}>Habitación</div>
                  <div style={valueStyle}>{row.room_number ?? "—"}</div>
                </div>

                <div style={panelStyle}>
                  <div style={labelStyle}>Score auditoría</div>
                  <div style={valueStyle}>{row.audit_score == null ? "—" : row.audit_score}</div>
                </div>
              </div>

              {openItemId === row.backlog_item_id ? (
                <div
                  style={{
                    marginTop: 2,
                    display: "grid",
                    gap: 10,
                    borderTop: "1px solid var(--border)",
                    paddingTop: 10,
                  }}
                >
                  <div
                    style={{
                      ...panelStyle,
                      display: "grid",
                      gap: 10,
                      padding: 12,
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={labelStyle}>Estado</div>
                        <select
                          value={getDraft(row).status}
                          disabled={storageMode === "fallback"}
                          onChange={(event) => updateDraft(row.backlog_item_id, { status: event.target.value })}
                          style={{
                            padding: "9px 11px",
                            borderRadius: 10,
                            border: "1px solid var(--border)",
                            background: "var(--card-bg)",
                          }}
                        >
                          <option value="open">open</option>
                          <option value="in_progress">in_progress</option>
                          <option value="resolved">resolved</option>
                        </select>
                      </div>

                      <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
                        <div style={labelStyle}>Reauditoría</div>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                          <input
                            type="checkbox"
                            checked={getDraft(row).ready_for_reaudit}
                            disabled={storageMode === "fallback"}
                            onChange={(event) =>
                              updateDraft(row.backlog_item_id, { ready_for_reaudit: event.target.checked })
                            }
                          />
                          Listo para reauditoría
                        </label>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={labelStyle}>Solución / qué se hizo</div>
                      <textarea
                        value={getDraft(row).resolution_comment}
                        onChange={(event) =>
                          updateDraft(row.backlog_item_id, { resolution_comment: event.target.value })
                        }
                        rows={4}
                        disabled={storageMode === "fallback"}
                        style={{
                          width: "100%",
                          resize: "vertical",
                          padding: 10,
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                          background: "var(--card-bg)",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 12, opacity: 0.65, display: "grid", gap: 2 }}>
                        <span>Última actualización: {fmtDate(row.updated_at ?? row.created_at)}</span>
                        {storageMode === "fallback" ? (
                          <span>La edición se habilita en cuanto exista `department_backlog_items` en la base.</span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => void saveItem(row)}
                        disabled={storageMode === "fallback" || savingItemId === row.backlog_item_id}
                        style={{
                          ...(storageMode === "fallback" ? btnStyle : primaryBtnStyle),
                          opacity: storageMode === "fallback" ? 0.6 : 1,
                        }}
                      >
                        {storageMode === "fallback"
                          ? "Aplicar migración para editar"
                          : savingItemId === row.backlog_item_id
                            ? "Guardando..."
                            : "Guardar cambios"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
