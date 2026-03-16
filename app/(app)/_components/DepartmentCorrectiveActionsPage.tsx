"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import type { DepartmentCode } from "@/hooks/useDepartmentCorrectiveActions";
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
}: {
  department: DepartmentCode;
  title: string;
  description: string;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const { data, error, isLoading } = useDepartmentCorrectiveActions(userId, department);

  useEffect(() => {
    let cancelled = false;

    async function loadAuth() {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (cancelled) return;

      if (authErr || !authData.user) {
        router.replace("/login");
        return;
      }

      setUserId(authData.user.id);
      setAuthLoading(false);
    }

    void loadAuth();

    return () => {
      cancelled = true;
    };
  }, [department, router]);

  useEffect(() => {
    if (!data?.redirectTo) return;
    router.replace(data.redirectTo);
  }, [data?.redirectTo, router]);

  const stats = useMemo(() => {
    return (data?.rows ?? []).reduce(
      (acc, row) => {
        if (row.status === "open") acc.open += 1;
        else if (row.status === "in_progress") acc.inProgress += 1;
        else if (row.status === "resolved") acc.resolved += 1;
        return acc;
      },
      { open: 0, inProgress: 0, resolved: 0 }
    );
  }, [data?.rows]);

  const rows = data?.rows ?? [];
  const scopeLabel = data?.scopeLabel ?? "";
  const userName = data?.userName ?? null;
  const loading = authLoading || isLoading;
  const errorMessage = error instanceof Error ? error.message : "";

  return (
    <div style={{ padding: "12px 14px 18px", width: "100%", display: "grid", gap: 16 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
        <div style={{ opacity: 0.85, marginTop: 4 }}>
          Hola, <b>{userName ?? "—"}</b> · Departamento: <b>{department === "it" ? "IT" : "Engineering"}</b>
        </div>
        <div style={{ opacity: 0.65, marginTop: 4, fontSize: 12 }}>{description}</div>
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

      {loading ? <Card><div style={{ fontWeight: 900 }}>Cargando corrective actions…</div></Card> : null}

      {errorMessage ? (
        <Card style={{ border: "1px solid rgba(255,0,0,0.25)", color: "crimson" }}>
          <b>Error:</b> {errorMessage}
        </Card>
      ) : null}

      {!loading && !errorMessage && rows.length === 0 ? (
        <Card>
          <div style={{ fontWeight: 900 }}>No hay acciones correctivas</div>
          <div style={{ marginTop: 6, opacity: 0.72 }}>
            No hay registros dentro del alcance visible para esta ruta.
          </div>
        </Card>
      ) : null}

      {!loading && !errorMessage ? (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row) => (
            <Card key={row.corrective_action_id} style={{ display: "grid", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 900 }}>{row.title}</div>
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
                  }}
                >
                  {row.status}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 10,
                  fontSize: 14,
                }}
              >
                <div>
                  <div style={{ opacity: 0.6, fontSize: 12, fontWeight: 800 }}>Habitación</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>{row.room_number ?? "—"}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.6, fontSize: 12, fontWeight: 800 }}>Score auditoría</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>
                    {row.audit_score == null ? "—" : row.audit_score}
                  </div>
                </div>
                <div>
                  <div style={{ opacity: 0.6, fontSize: 12, fontWeight: 800 }}>Fecha</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>{fmtDate(row.created_at)}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
