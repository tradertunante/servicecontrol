"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import {
  getDepartmentRedirectTarget,
  getDepartmentRouteScope,
  normalizeDepartmentCode,
} from "../_lib/departmentAccess";

type DepartmentCode = "it" | "engineering";

type DepartmentActionRow = {
  corrective_action_id: string;
  audit_run_id: string;
  question_id: string;
  title: string;
  status: string;
  assigned_department_id: string | null;
  assigned_department: string | null;
  hotel_id: string;
  area_id: string;
  room_number: string | null;
  audit_score: number | null;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  hotel_id: string | null;
  active: boolean | null;
  assigned_department_id?: string | null;
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<DepartmentActionRow[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [scopeLabel, setScopeLabel] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr || !authData.user) {
          router.replace("/login");
          return;
        }

        const uid = authData.user.id;

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("id, full_name, role, hotel_id, active, assigned_department_id")
          .eq("id", uid)
          .single();

        if (profileErr || !profile) {
          if (!cancelled) setError(profileErr?.message ?? "No se pudo cargar tu perfil.");
          return;
        }

        const typedProfile = profile as ProfileRow;
        if (typedProfile.active === false) {
          router.replace(getDepartmentRedirectTarget(typedProfile.role, null));
          return;
        }

        let assignedDepartmentCode: string | null = null;
        const assignedDepartmentId = typedProfile.assigned_department_id ?? null;

        if (assignedDepartmentId) {
          const { data: departmentRow, error: departmentErr } = await supabase
            .from("hotel_departments")
            .select("code")
            .eq("id", assignedDepartmentId)
            .maybeSingle();

          if (departmentErr) {
            if (!cancelled) setError(departmentErr.message);
            return;
          }

          assignedDepartmentCode = normalizeDepartmentCode(
            (departmentRow as { code?: string | null } | null)?.code ?? null
          );
        }

        const { data: areaScopeRows, error: areaScopeErr } = await supabase
          .from("user_area_access")
          .select("area_id")
          .eq("user_id", uid)
          .eq("hotel_id", typedProfile.hotel_id ?? "")
          .limit(1);

        if (areaScopeErr) {
          if (!cancelled) setError(areaScopeErr.message);
          return;
        }

        const hasAreaScope = (areaScopeRows ?? []).some(
          (row: { area_id?: string | null }) => !!row.area_id
        );

        const routeScope = getDepartmentRouteScope(department, assignedDepartmentCode, hasAreaScope);

        if (routeScope === "none") {
          router.replace(getDepartmentRedirectTarget(typedProfile.role, assignedDepartmentCode));
          return;
        }

        const { data: actions, error: actionsErr } = await supabase.rpc(
          "get_scoped_department_corrective_actions",
          { p_user_id: uid, p_target_department_code: department }
        );

        if (actionsErr) throw actionsErr;
        if (cancelled) return;

        setUserName(typedProfile.full_name ?? null);
        setScopeLabel(
          routeScope === "department"
            ? "Visibilidad completa de tu departamento."
            : "Visibilidad limitada a las áreas operativas que tienes asignadas."
        );
        setRows((actions ?? []) as DepartmentActionRow[]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "No se pudo cargar el panel del departamento.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [department, router]);

  const stats = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.status === "open") acc.open += 1;
        else if (row.status === "in_progress") acc.inProgress += 1;
        else if (row.status === "resolved") acc.resolved += 1;
        return acc;
      },
      { open: 0, inProgress: 0, resolved: 0 }
    );
  }, [rows]);

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

      {error ? (
        <Card style={{ border: "1px solid rgba(255,0,0,0.25)", color: "crimson" }}>
          <b>Error:</b> {error}
        </Card>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <Card>
          <div style={{ fontWeight: 900 }}>No hay acciones correctivas</div>
          <div style={{ marginTop: 6, opacity: 0.72 }}>
            No hay registros dentro del alcance visible para esta ruta.
          </div>
        </Card>
      ) : null}

      {!loading && !error ? (
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
