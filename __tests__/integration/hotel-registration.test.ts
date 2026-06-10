/**
 * Flujo: registro de hotel y setup inicial.
 *
 * Cubre:
 *  - Alta de hotel con defaults (status, timezone).
 *  - Sincronización auth.users → profiles vía trigger sync_profile_from_auth_user
 *    (rol válido, rol inválido → fallback 'auditor', update de metadata, is_trial).
 *  - Trigger de limpieza al borrar el usuario auth.
 *  - Setup inicial: áreas, reglas de auditoría (hotel_audit_rules upsert único por hotel).
 *  - Aprovisionamiento de pack global estilo LHW: sync_global_audit_pack_to_hotel
 *    (clonado completo + idempotencia).
 *  - trial_leads: email único (edge case del funnel de registro).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { integrationEnabled, describeMissingEnv } from "./helpers/env";
import { TestBed } from "./helpers/factory";
import { adminClient } from "./helpers/clients";

const suite = describe.skipIf(!integrationEnabled);

if (!integrationEnabled) {
  console.warn(`[integration] suites omitidas, falta: ${describeMissingEnv()}`);
}

suite("Registro de hotel y setup inicial", () => {
  let bed: TestBed;
  let hotelId: string;

  beforeAll(async () => {
    bed = new TestBed();
    hotelId = await bed.createHotel("Registro");
  });

  afterAll(async () => {
    await bed.cleanup();
  });

  it("crea el hotel con defaults razonables (status, timezone, sin soft-delete)", async () => {
    const admin = adminClient();
    const { data: hotel, error } = await admin
      .from("hotels")
      .select("id, name, status, timezone, deleted_at, active")
      .eq("id", hotelId)
      .single();

    expect(error).toBeNull();
    expect(hotel?.name).toContain("Registro");
    expect(hotel?.status).toBeTruthy();
    expect(hotel?.timezone).toBeTruthy();
    expect(hotel?.deleted_at).toBeNull();
  });

  describe("sincronización auth → profiles (trigger)", () => {
    it("crea el profile automáticamente con rol, hotel y full_name del metadata", async () => {
      const user = await bed.createUser({
        hotelId,
        role: "admin",
        fullName: bed.label("Admin Registro"),
        ensureProfile: false, // queremos probar el trigger, sin fallback
      });

      const { data: profile, error } = await adminClient()
        .from("profiles")
        .select("id, email, full_name, role, hotel_id, active, is_trial")
        .eq("id", user.id)
        .single();

      expect(error).toBeNull();
      expect(profile?.email).toBe(user.email);
      expect(profile?.role).toBe("admin");
      expect(profile?.hotel_id).toBe(hotelId);
      expect(profile?.active).toBe(true);
      expect(profile?.is_trial).toBe(false);
    });

    it("normaliza un rol inválido en metadata a 'auditor' (default seguro)", async () => {
      const user = await bed.createUser({
        hotelId,
        role: "definitely_not_a_role",
        ensureProfile: false,
      });

      const { data: profile } = await adminClient()
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      expect(profile?.role).toBe("auditor");
    });

    it("el sync de metadata solo ocurre en el alta: updates posteriores no tocan el profile", async () => {
      // Comportamiento actual verificado: el trigger corre on INSERT en auth.users.
      // Cambiar metadata después del alta NO re-sincroniza el profile; los cambios
      // de rol se hacen directamente sobre public.profiles (flujo de admin).
      const admin = adminClient();
      const user = await bed.createUser({ hotelId, role: "auditor", ensureProfile: false });

      const { error } = await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          full_name: bed.label("Renombrado"),
          role: "manager",
          hotel_id: hotelId,
          active: false,
        },
      });
      expect(error).toBeNull();

      const { data: profile } = await admin
        .from("profiles")
        .select("role, active")
        .eq("id", user.id)
        .single();

      expect(profile?.role).toBe("auditor"); // sin cambios
      expect(profile?.active).toBe(true);
    });

    it("al borrar el usuario auth desaparecen su profile y sus accesos a áreas", async () => {
      const admin = adminClient();
      const user = await bed.createUser({ hotelId, role: "auditor" });
      const areaId = await bed.createArea(hotelId, "Área cleanup");
      await bed.grantAreaAccess(user.id, hotelId, areaId);

      const { error } = await admin.auth.admin.deleteUser(user.id);
      expect(error).toBeNull();

      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      const { data: access } = await admin
        .from("user_area_access")
        .select("id")
        .eq("user_id", user.id);

      expect(profile).toBeNull();
      expect(access ?? []).toHaveLength(0);
    });
  });

  describe("setup inicial del hotel", () => {
    it("permite crear áreas operativas asociadas al hotel", async () => {
      const areaId = await bed.createArea(hotelId, "Housekeeping");
      const { data: area } = await adminClient()
        .from("areas")
        .select("id, hotel_id, active")
        .eq("id", areaId)
        .single();

      expect(area?.hotel_id).toBe(hotelId);
      expect(area?.active).toBe(true);
    });

    it("hotel_audit_rules es único por hotel: el upsert actualiza en vez de duplicar", async () => {
      await bed.setAuditRules(hotelId, { autoReauditEnabled: true, autoReauditThreshold: 85 });
      await bed.setAuditRules(hotelId, { autoReauditEnabled: false, autoReauditThreshold: 70 });

      const { data: rules } = await adminClient()
        .from("hotel_audit_rules")
        .select("auto_reaudit_enabled, auto_reaudit_threshold")
        .eq("hotel_id", hotelId);

      expect(rules).toHaveLength(1);
      expect(rules?.[0]?.auto_reaudit_enabled).toBe(false);
      expect(Number(rules?.[0]?.auto_reaudit_threshold)).toBe(70);
    });
  });

  describe("aprovisionamiento de pack global (LHW)", () => {
    it("sync_global_audit_pack_to_hotel clona plantillas, secciones y preguntas", async () => {
      const admin = adminClient();
      const { packId, globalTemplateId } = await bed.createGlobalPack({
        templateName: "CHECK OUT -LHW",
        questions: [{ text: "Despedida con nombre" }, { text: "Factura sin errores" }],
      });

      const { data: added, error } = await admin.rpc("sync_global_audit_pack_to_hotel", {
        p_pack_id: packId,
        p_target_hotel_id: hotelId,
      });
      expect(error).toBeNull();
      expect(added).toBe(1);

      const { data: cloned } = await admin
        .from("audit_templates")
        .select("id, name, scope, area_id, source_template_id, pack_id")
        .eq("hotel_id", hotelId)
        .eq("pack_id", packId);

      expect(cloned).toHaveLength(1);
      const clone = cloned![0];
      expect(clone.scope).toBe("hotel");
      expect(clone.area_id).toBeNull(); // el admin asigna área después
      expect(clone.source_template_id).toBe(globalTemplateId);
      expect(clone.name).toContain("CHECK OUT -LHW");

      const { data: sections } = await admin
        .from("audit_sections")
        .select("id")
        .eq("audit_template_id", clone.id);
      expect(sections).toHaveLength(1);

      const { data: questions } = await admin
        .from("audit_questions")
        .select("id")
        .eq("audit_section_id", sections![0].id);
      expect(questions).toHaveLength(2);
    });

    it("es idempotente: re-sincronizar no duplica plantillas", async () => {
      const admin = adminClient();
      const { packId } = await bed.createGlobalPack({
        templateName: "DEPARTURE -LHW",
        questions: [{ text: "Equipaje gestionado" }],
      });

      const first = await admin.rpc("sync_global_audit_pack_to_hotel", {
        p_pack_id: packId,
        p_target_hotel_id: hotelId,
      });
      const second = await admin.rpc("sync_global_audit_pack_to_hotel", {
        p_pack_id: packId,
        p_target_hotel_id: hotelId,
      });

      expect(first.data).toBe(1);
      expect(second.data).toBe(0);

      const { data: clones } = await admin
        .from("audit_templates")
        .select("id")
        .eq("hotel_id", hotelId)
        .eq("pack_id", packId);
      expect(clones).toHaveLength(1);
    });
  });

  describe("trial_leads (funnel de registro)", () => {
    it("rechaza dos leads con el mismo email (unique constraint)", async () => {
      const admin = adminClient();
      const { email } = await bed.createTrialLead("Lead 1", "Hotel Trial");

      const { error } = await admin
        .from("trial_leads")
        .insert({ name: bed.label("Lead 2"), email, hotel_name: bed.label("Otro Hotel") })
        .select("id")
        .single();

      expect(error).not.toBeNull();
      expect(error?.code).toBe("23505"); // unique_violation
    });
  });
});