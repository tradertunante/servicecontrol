"use client";

import { useQuery } from "@tanstack/react-query";

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
  area_name?: string | null;
  audit_template_id?: string | null;
  template_name?: string | null;
  owner_department?: string | null;
  room_number: string | null;
  audit_score: number | null;
  created_at: string | null;
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
  _userId: string,
  department: DepartmentCode
): Promise<DepartmentCorrectiveActionsResult> {
  const response = await fetch(`/api/departments/backlog?department=${department}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | (DepartmentCorrectiveActionsResult & { ok?: boolean; error?: string | null })
    | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? "No se pudo cargar el backlog operativo del departamento.");
  }

  return {
    redirectTo: payload.redirectTo ?? null,
    rows: (payload.rows ?? []) as DepartmentActionRow[],
    scopeLabel: payload.scopeLabel ?? "",
    userName: payload.userName ?? null,
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
