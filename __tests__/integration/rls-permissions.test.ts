/**
 * Flujo: roles y permisos (enforcement de RLS).
 *
 * Verifica con clientes reales (anon key + sesión) que las policies sc_* hacen
 * cumplir el modelo de roles:
 *  - Visitantes anónimos no leen nada.
 *  - Los RPCs transaccionales (start/submit) están revocados para authenticated:
 *    solo el service-role de los route handlers puede invocarlos.
 *  - Auditor: visibilidad condicionada a asignación de área; sin permisos de
 *    administración (plantillas, profiles).
 *  - Admin: gestión dentro de su hotel.
 *  - Acciones correctivas: visibles para admin, ocultas para auditor.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { integrationEnabled } from "./helpers/env";
import { TestBed, type TestTemplate, type TestUser } from "./helpers/factory";
import { anonClient, signedInClient, type Db } from "./helpers/clients";

const suite = describe.skipIf(!integrationEnabled);

suite("Roles y permisos (RLS)", () => {
  let bed: TestBed;
  let hotelId: string;
  let areaId: string;
  let template: TestTemplate;
  let admin: TestUser;
  let auditorAssigned: TestUser;
  let auditorUnassigned: TestUser;
  let runId: string;

  let adminDb: Db;
  let assignedDb: Db;
  let unassignedDb: Db;

  beforeAll(async () => {
    bed = new TestBed();
    hotelId = await bed.createHotel("RLS");
    areaId = await bed.createArea(hotelId, "Restaurante");
    template = await bed.createTemplate({
      hotelId,
      areaId,
      name: "Servicio de sala",
      questions: [
        {
          text: "Mesa montada",
          correctiveFlow: "non_operational",
          responsibleDepartment: "engineering",
        },
        { text: "Carta actualizada" },
      ],
    });
    admin = await bed.createUser({ hotelId, role: "admin" });
    auditorAssigned = await bed.createUser({ hotelId, role: "auditor" });
    auditorUnassigned = await bed.createUser({ hotelId, role: "auditor" });
    await bed.grantAreaAccess(auditorAssigned.id, hotelId, areaId);

    // Un run enviado con un FAIL non_operational → genera acción correctiva.
    const { runId: id } = await bed.runFullAudit({
      hotelId,
      areaId,
      template,
      actorId: admin.id,
      answers: { [template.questionIds[0]]: "FAIL" },
    });
    runId = id;

    adminDb = await signedInClient(admin.email, admin.password);
    assignedDb = await signedInClient(auditorAssigned.email, auditorAssigned.password);
    unassignedDb = await signedInClient(auditorUnassigned.email, auditorUnassigned.password);
  });

  afterAll(async () => {
    await Promise.all([adminDb, assignedDb, unassignedDb].map((c) => c?.auth.signOut()));
    await bed.cleanup();
  });

  describe("anónimo (sin sesión)", () => {
    it("no lee hoteles, profiles ni runs", async () => {
      const anon = anonClient();

      const hotels = await anon.from("hotels").select("id").eq("id", hotelId);
      const profiles = await anon.from("profiles").select("id").eq("hotel_id", hotelId);
      const runs = await anon.from("audit_runs").select("id").eq("hotel_id", hotelId);

      expect(hotels.data ?? []).toHaveLength(0);
      expect(profiles.data ?? []).toHaveLength(0);
      expect(runs.data ?? []).toHaveLength(0);
    });
  });

  describe("RPCs transaccionales revocados para authenticated", () => {
    it("un usuario autenticado no puede invocar start_audit_run directamente", async () => {
      const { error } = await adminDb.rpc("start_audit_run", {
        p_hotel_id: hotelId,
        p_area_id: areaId,
        p_template_id: template.templateId,
        p_actor_user_id: admin.id,
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
    });

    it("un usuario autenticado no puede invocar submit_audit_run directamente", async () => {
      const { error } = await adminDb.rpc("submit_audit_run", {
        p_run_id: runId,
        p_actor_user_id: admin.id,
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied/i);
    });
  });

  describe("auditor sin asignación de área", () => {
    it("no ve el área, ni los runs, ni las respuestas", async () => {
      const areas = await unassignedDb.from("areas").select("id").eq("id", areaId);
      const runs = await unassignedDb.from("audit_runs").select("id").eq("id", runId);
      const answers = await unassignedDb
        .from("audit_answers")
        .select("id")
        .eq("audit_run_id", runId);

      expect(areas.data ?? []).toHaveLength(0);
      expect(runs.data ?? []).toHaveLength(0);
      expect(answers.data ?? []).toHaveLength(0);
    });
  });

  describe("auditor con asignación de área", () => {
    it("ve el área, los runs del área y sus respuestas", async () => {
      const areas = await assignedDb.from("areas").select("id").eq("id", areaId);
      const runs = await assignedDb.from("audit_runs").select("id").eq("id", runId);
      const answers = await assignedDb
        .from("audit_answers")
        .select("id")
        .eq("audit_run_id", runId);

      expect(areas.data).toHaveLength(1);
      expect(runs.data).toHaveLength(1);
      expect(answers.data?.length).toBeGreaterThan(0);
    });

    it("puede editar respuestas de un run de su área (autosave de draft)", async () => {
      const draftId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: template.templateId,
        actorId: auditorAssigned.id,
      });

      const { data, error } = await assignedDb
        .from("audit_answers")
        .update({ answer: "FAIL", result: "FAIL", comment: "RLS edit" })
        .eq("audit_run_id", draftId)
        .eq("question_id", template.questionIds[1])
        .select("id");

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("no puede crear plantillas (escritura reservada a admin)", async () => {
      const { data, error } = await assignedDb
        .from("audit_templates")
        .insert({
          hotel_id: hotelId,
          area_id: areaId,
          name: bed.label("Plantilla pirata"),
          scope: "hotel",
        })
        .select("id");

      expect(data ?? []).toHaveLength(0);
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501"); // RLS violation
    });

    it("no puede escalar su propio rol (trigger anti-escalada en profiles)", async () => {
      // Usuario desechable para no contaminar al auditor compartido si la
      // escalada llegara a tener éxito.
      const throwaway = await bed.createUser({ hotelId, role: "auditor" });
      const throwawayDb = await signedInClient(throwaway.email, throwaway.password);

      try {
        const { error } = await throwawayDb
          .from("profiles")
          .update({ role: "admin" })
          .eq("id", throwaway.id)
          .select("id");

        // El trigger lanza 42501; aunque no lo hiciera, el rol no debe cambiar.
        expect(error?.code === "42501" || error === null).toBe(true);

        const { data: profile } = await bed.admin
          .from("profiles")
          .select("role")
          .eq("id", throwaway.id)
          .single();
        expect(profile?.role).toBe("auditor");
      } finally {
        await throwawayDb.auth.signOut();
      }
    });

    it("sí puede actualizar campos no sensibles de su propio perfil (onboarding)", async () => {
      // El self-update sigue permitido; solo role/hotel_id/active están blindados.
      const { error } = await assignedDb
        .from("profiles")
        .update({ full_name: bed.label("Auditor renombrado") })
        .eq("id", auditorAssigned.id)
        .select("id")
        .single();
      expect(error).toBeNull();
    });

    it("no ve acciones correctivas (visibilidad de admin/quality/manager)", async () => {
      const { data } = await assignedDb
        .from("audit_corrective_actions")
        .select("id")
        .eq("audit_run_id", runId);
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("admin del hotel", () => {
    it("ve su hotel, las áreas y los profiles del equipo", async () => {
      const hotels = await adminDb.from("hotels").select("id").eq("id", hotelId);
      const areas = await adminDb.from("areas").select("id").eq("hotel_id", hotelId);
      const profiles = await adminDb.from("profiles").select("id").eq("hotel_id", hotelId);

      expect(hotels.data).toHaveLength(1);
      expect(areas.data!.length).toBeGreaterThan(0);
      expect(profiles.data!.length).toBeGreaterThanOrEqual(3);
    });

    it("puede cambiar el rol de un miembro de su hotel", async () => {
      const target = await bed.createUser({ hotelId, role: "auditor" });

      const { data, error } = await adminDb
        .from("profiles")
        .update({ role: "quality" })
        .eq("id", target.id)
        .select("id, role");

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.role).toBe("quality");
    });

    it("puede crear plantillas en su hotel", async () => {
      const { data, error } = await adminDb
        .from("audit_templates")
        .insert({
          hotel_id: hotelId,
          area_id: areaId,
          name: bed.label("Plantilla de admin"),
          scope: "hotel",
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
    });

    it("ve las acciones correctivas de su hotel", async () => {
      const { data, error } = await adminDb
        .from("audit_corrective_actions")
        .select("id, status")
        .eq("audit_run_id", runId);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.status).toBe("open");
    });
  });
});