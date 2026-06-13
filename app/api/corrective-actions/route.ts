import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["superadmin", "admin", "general_manager", "manager", "quality", "engineering", "systems", "it"],
  });
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelResult = await resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const hotelId = hotelResult.hotelId;
  const role = caller.profile.role;

  const admin = supabaseAdmin();

  // Fetch corrective actions with area join
  let query = admin
    .from("audit_corrective_actions")
    .select(
      "id,hotel_id,area_id,audit_run_id,reaudit_run_id,question_id,team_member_id," +
      "assigned_department,status,title,description,evidence_note,evidence_photo_path," +
      "opened_at,resolved_at,resolved_by,blocks_reaudit,due_date,assigned_to," +
      "areas!area_id(name)"
    )
    .eq("hotel_id", hotelId)
    .order("opened_at", { ascending: false })
    .limit(1000);

  // Department-scoped users only see their own actions
  if (role === "engineering") {
    query = query.eq("assigned_department", "engineering");
  } else if (role === "systems" || role === "it") {
    query = query.eq("assigned_department", "systems");
  }

  const { data: actions, error: actionsErr } = await query;
  if (actionsErr) return jsonDbError(actionsErr);

  const rows = (actions ?? []) as unknown as Record<string, unknown>[];

  // Collect profile IDs needed (assigned_to, resolved_by)
  const profileIds = Array.from(
    new Set([
      ...rows.map((r) => r.assigned_to as string | null),
      ...rows.map((r) => r.resolved_by as string | null),
    ].filter(Boolean) as string[])
  );

  // Collect team member IDs
  const teamMemberIds = Array.from(
    new Set(rows.map((r) => r.team_member_id as string | null).filter(Boolean) as string[])
  );

  const [profilesRes, teamRes, hotelProfilesRes] = await Promise.all([
    profileIds.length
      ? admin.from("profiles").select("id,full_name").in("id", profileIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[], error: null }),
    teamMemberIds.length
      ? admin.from("team_members").select("id,full_name").in("id", teamMemberIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[], error: null }),
    // Hotel profiles for the assignee dropdown
    admin
      .from("profiles")
      .select("id,full_name,role")
      .eq("hotel_id", hotelId)
      .in("role", ["admin", "general_manager", "manager", "quality", "engineering", "systems", "it"])
      .order("full_name"),
  ]);

  if (profilesRes.error) return jsonDbError(profilesRes.error);
  if (teamRes.error) return jsonDbError(teamRes.error);
  if (hotelProfilesRes.error) return jsonDbError(hotelProfilesRes.error);

  const profileMap = new Map<string, string | null>();
  for (const p of (profilesRes.data ?? [])) profileMap.set(p.id, p.full_name ?? null);

  const teamMap = new Map<string, string>();
  for (const tm of (teamRes.data ?? [])) teamMap.set(tm.id, tm.full_name);

  const enriched = rows.map((row) => {
    const area = row.areas as { name: string } | null;
    return {
      id: row.id,
      hotel_id: row.hotel_id,
      area_id: row.area_id,
      area_name: area?.name ?? null,
      audit_run_id: row.audit_run_id,
      reaudit_run_id: row.reaudit_run_id,
      question_id: row.question_id,
      team_member_id: row.team_member_id,
      team_member_name: row.team_member_id ? teamMap.get(row.team_member_id as string) ?? null : null,
      assigned_department: row.assigned_department,
      assigned_to: row.assigned_to,
      assigned_to_name: row.assigned_to ? profileMap.get(row.assigned_to as string) ?? null : null,
      status: row.status,
      title: row.title,
      description: row.description,
      evidence_note: row.evidence_note,
      opened_at: row.opened_at,
      resolved_at: row.resolved_at,
      resolved_by: row.resolved_by,
      resolved_by_name: row.resolved_by ? profileMap.get(row.resolved_by as string) ?? null : null,
      blocks_reaudit: row.blocks_reaudit,
      due_date: row.due_date,
    };
  });

  return NextResponse.json({
    actions: enriched,
    hotelProfiles: hotelProfilesRes.data ?? [],
  });
}