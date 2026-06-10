import type { Db } from "./clients";

/**
 * Borra un hotel de test y todo su árbol de dependencias, en orden inverso de
 * FKs. Devuelve los errores encontrados (el caller decide si lanzar o avisar).
 */
export async function purgeHotel(admin: Db, hotelId: string): Promise<string[]> {
  const errors: string[] = [];
  const track = (label: string) => (res: { error: { message: string } | null }) => {
    if (res.error) errors.push(`${label}: ${res.error.message}`);
  };

  const { data: runs } = await admin.from("audit_runs").select("id").eq("hotel_id", hotelId);
  const runIds = (runs ?? []).map((r) => r.id);

  if (runIds.length > 0) {
    track("audit_answers")(await admin.from("audit_answers").delete().in("audit_run_id", runIds));
    track("department_backlog_items")(
      await admin.from("department_backlog_items").delete().in("audit_run_id", runIds)
    );
  }
  track("audit_corrective_actions")(
    await admin.from("audit_corrective_actions").delete().eq("hotel_id", hotelId)
  );
  if (runIds.length > 0) {
    // Reauditorías (FK a parent) antes que los runs raíz.
    track("audit_runs (reaudits)")(
      await admin
        .from("audit_runs")
        .delete()
        .eq("hotel_id", hotelId)
        .not("parent_audit_run_id", "is", null)
    );
    track("audit_runs")(await admin.from("audit_runs").delete().eq("hotel_id", hotelId));
  }

  track("area_template_target_assignments")(
    await admin.from("area_template_target_assignments").delete().eq("hotel_id", hotelId)
  );
  track("area_template_targets")(
    await admin.from("area_template_targets").delete().eq("hotel_id", hotelId)
  );
  track("audit_logs")(await admin.from("audit_logs").delete().eq("hotel_id", hotelId));
  track("notifications")(await admin.from("notifications").delete().eq("hotel_id", hotelId));
  track("score_events")(await admin.from("score_events").delete().eq("hotel_id", hotelId));
  track("user_scores")(await admin.from("user_scores").delete().eq("hotel_id", hotelId));

  const { data: templates } = await admin
    .from("audit_templates")
    .select("id")
    .eq("hotel_id", hotelId);
  errors.push(...(await deleteTemplateTrees(admin, (templates ?? []).map((t) => t.id))));

  track("hotel_audit_rules")(
    await admin.from("hotel_audit_rules").delete().eq("hotel_id", hotelId)
  );
  track("user_area_access")(
    await admin.from("user_area_access").delete().eq("hotel_id", hotelId)
  );
  track("areas")(await admin.from("areas").delete().eq("hotel_id", hotelId));
  track("profiles")(await admin.from("profiles").delete().eq("hotel_id", hotelId));
  track("hotels")(await admin.from("hotels").delete().eq("id", hotelId));

  return errors;
}

export async function deleteTemplateTrees(admin: Db, templateIds: string[]): Promise<string[]> {
  if (templateIds.length === 0) return [];
  const errors: string[] = [];
  const { data: sections } = await admin
    .from("audit_sections")
    .select("id")
    .in("audit_template_id", templateIds);
  const sectionIds = (sections ?? []).map((s) => s.id);
  if (sectionIds.length > 0) {
    const q = await admin.from("audit_questions").delete().in("audit_section_id", sectionIds);
    if (q.error) errors.push(`audit_questions: ${q.error.message}`);
    const s = await admin.from("audit_sections").delete().in("id", sectionIds);
    if (s.error) errors.push(`audit_sections: ${s.error.message}`);
  }
  const t = await admin.from("audit_templates").delete().in("id", templateIds);
  if (t.error) errors.push(`audit_templates: ${t.error.message}`);
  return errors;
}