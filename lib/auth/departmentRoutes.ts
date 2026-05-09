import "server-only";

import { redirect } from "next/navigation";

import {
  getDepartmentRedirectTarget,
  getDepartmentRouteScope,
  normalizeDepartmentCode,
  resolveDepartmentCode,
  type DepartmentCode,
} from "@/app/(app)/_lib/departmentAccess";
import { requireHotelScope } from "@/lib/auth/server";
import { getHotelEnabledPacks } from "@/lib/auth/packs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type DepartmentRoute = Exclude<DepartmentCode, null>;

export async function requireDepartmentRouteAccess(
  routeDepartment: DepartmentRoute,
  nextPath: string
) {
  const auth = await requireHotelScope(undefined, { nextPath });
  const admin = supabaseAdmin();

  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .select("assigned_department_id")
    .eq("id", auth.profile.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  let assignedDepartmentCode = resolveDepartmentCode(auth.profile.role, null);
  const assignedDepartmentId = String(profileRow?.assigned_department_id ?? "").trim() || null;

  if (assignedDepartmentId) {
    const { data: departmentRow, error: departmentError } = await admin
      .from("hotel_departments")
      .select("code")
      .eq("id", assignedDepartmentId)
      .maybeSingle();

    if (departmentError) {
      throw new Error(departmentError.message);
    }

    assignedDepartmentCode = resolveDepartmentCode(
      auth.profile.role,
      normalizeDepartmentCode(departmentRow?.code ?? null)
    );
  }

  const hotelId = auth.hotelId;
  let hasAreaScope = false;

  if (hotelId) {
    const { data: areaScopeRows, error: areaScopeError } = await admin
      .from("user_area_access")
      .select("area_id")
      .eq("user_id", auth.profile.id)
      .eq("hotel_id", hotelId)
      .limit(1);

    if (areaScopeError) {
      throw new Error(areaScopeError.message);
    }

    hasAreaScope = (areaScopeRows ?? []).some(
      (row: { area_id?: string | null }) => !!row.area_id
    );
  }

  const routeScope = getDepartmentRouteScope(
    routeDepartment,
    auth.profile.role,
    assignedDepartmentCode,
    hasAreaScope
  );

  if (routeScope === "none") {
    redirect(getDepartmentRedirectTarget(auth.profile.role, assignedDepartmentCode));
  }

  // IT requiere pack_it, Engineering requiere pack_engineering
  if (auth.profile.role !== "superadmin" && hotelId) {
    const packs = await getHotelEnabledPacks(hotelId);
    const requiredPack = routeDepartment === "it" ? "pack_it" : "pack_engineering";
    if (!packs.includes(requiredPack)) {
      redirect(getDepartmentRedirectTarget(auth.profile.role, assignedDepartmentCode));
    }
  }

  return {
    profile: auth.profile,
    routeScope,
    assignedDepartmentCode,
  };
}
