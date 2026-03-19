"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  getDepartmentRedirectTarget,
  getDepartmentRouteScope,
  normalizeDepartmentCode,
} from "@/app/(app)/_lib/departmentAccess";

export type DepartmentCode = "it" | "engineering";

export type DepartmentActionRow = {
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

export type DepartmentCorrectiveActionsResult = {
  redirectTo: string | null;
  rows: DepartmentActionRow[];
  scopeLabel: string;
  userName: string | null;
};

export function getDepartmentCorrectiveActionsQueryKey(
  userId: string,
  department: DepartmentCode
) {
  return ["department-corrective-actions", userId, department] as const;
}

export async function fetchDepartmentCorrectiveActions(
  userId: string,
  department: DepartmentCode
): Promise<DepartmentCorrectiveActionsResult> {
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, hotel_id, active, assigned_department_id")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    throw profileErr ?? new Error("No se pudo cargar tu perfil.");
  }

  const typedProfile = profile as ProfileRow;
  if (typedProfile.active === false) {
    return {
      redirectTo: getDepartmentRedirectTarget(typedProfile.role, null),
      rows: [],
      scopeLabel: "",
      userName: typedProfile.full_name ?? null,
    };
  }

  let assignedDepartmentCode: string | null = null;
  const assignedDepartmentId = typedProfile.assigned_department_id ?? null;

  if (assignedDepartmentId) {
    const { data: departmentRow, error: departmentErr } = await supabase
      .from("hotel_departments")
      .select("code")
      .eq("id", assignedDepartmentId)
      .maybeSingle();

    if (departmentErr) throw departmentErr;

    assignedDepartmentCode = normalizeDepartmentCode(
      (departmentRow as { code?: string | null } | null)?.code ?? null
    );
  }

  const { data: areaScopeRows, error: areaScopeErr } = await supabase
    .from("user_area_access")
    .select("area_id")
    .eq("user_id", userId)
    .eq("hotel_id", typedProfile.hotel_id ?? "")
    .limit(1);

  if (areaScopeErr) throw areaScopeErr;

  const hasAreaScope = (areaScopeRows ?? []).some(
    (row: { area_id?: string | null }) => !!row.area_id
  );

  const routeScope = getDepartmentRouteScope(
    department,
    typedProfile.role,
    assignedDepartmentCode,
    hasAreaScope
  );

  if (routeScope === "none") {
    return {
      redirectTo: getDepartmentRedirectTarget(typedProfile.role, assignedDepartmentCode),
      rows: [],
      scopeLabel: "",
      userName: typedProfile.full_name ?? null,
    };
  }

  const { data: actions, error: actionsErr } = await supabase.rpc(
    "get_scoped_department_corrective_actions",
    { p_user_id: userId, p_target_department_code: department }
  );

  if (actionsErr) throw actionsErr;

  return {
    redirectTo: null,
    rows: (actions ?? []) as DepartmentActionRow[],
    scopeLabel:
      routeScope === "department"
        ? "Visibilidad completa de tu departamento."
        : "Visibilidad limitada a las areas operativas que tienes asignadas.",
    userName: typedProfile.full_name ?? null,
  };
}

export function useDepartmentCorrectiveActions(
  userId: string | null,
  department: DepartmentCode
) {
  return useQuery({
    queryKey: userId ? getDepartmentCorrectiveActionsQueryKey(userId, department) : ["department-corrective-actions", "anonymous", department],
    queryFn: () => {
      if (!userId) throw new Error("No hay usuario autenticado.");
      return fetchDepartmentCorrectiveActions(userId, department);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
