/**
 * Flujo: aislamiento de datos entre hoteles (multi-tenancy).
 *
 * Dos hoteles completos (A y B) con admin, auditor y datos de auditoría.
 * Comprueba que ningún rol de A puede leer, escribir o puntuar datos de B:
 *  - Lecturas cruzadas devuelven 0 filas en todas las tablas core.
 *  - Escrituras cruzadas se rechazan (42501) o no afectan filas.
 *  - Los RPCs server-side también aplican el guard de hotel (FORBIDDEN_HOTEL /
 *    AREA_OUT_OF_SCOPE), como defensa en profundidad ante un scope mal derivado.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { integrationEnabled } from "./helpers/env";
import { TestBed, type TestTemplate, type TestUser } from "./helpers/factory";
import { signedInClient, type Db } from "./helpers/clients";

const suite = describe.skipIf(!integrationEnabled);

type Tenant = {
  hotelId: string;
  areaId: string;
  template: TestTemplate;
  admin: TestUser;
  auditor: TestUser;
  runId: string;
};

suite("Aislamiento de datos entre hoteles", () => {
  let bed: TestBed;
  let a: Tenant;
  let b: Tenant;
  let adminADb: Db;
  let auditorADb: Db;

  async function buildTenant(name: string): Promise<Tenant> {
    const hotelId = await bed.createHotel(name);
    const areaId = await bed.createArea(hotelId, `${name} - Recepción`);
    const template = await bed.createTemplate({
      hotelId,
      areaId,
      name: `${name} - Plantilla`,
      questions: [{ text: "Q1" }, { text: "Q2" }],
    });
    const admin = await bed.createUser({ hotelId, role: "admin" });
    const auditor = await bed.createUser({ hotelId, role: "auditor" });
    await bed.grantAreaAccess(auditor.id, hotelId, areaId);
    // rpc_team_summary solo agrega usuarios con target asignado en el periodo.
    await bed.assignTarget({
      hotelId,
      areaId,
      templateId: template.templateId,
      userId: auditor.id,
      period: "monthly",
    });

    const { runId } = await bed.runFullAudit({
      hotelId,
      areaId,
      template,
      actorId: auditor.id,
      answers: { [template.questionIds[0]]: "FAIL" },
    });
    return { hotelId, areaId, template, admin, auditor, runId };
  }

  beforeAll(async () => {
    bed = new TestBed();
    a = await buildTenant("Tenant A");
    b = await buildTenant("Tenant B");
    adminADb = await signedInClient(a.admin.email, a.admin.password);
    auditorADb = await signedInClient(a.auditor.email, a.auditor.password);
  });

  afterAll(async () => {
    await Promise.all([adminADb, auditorADb].map((c) => c?.auth.signOut()));
    await bed.cleanup();
  });

  describe("lecturas cruzadas (admin de A sobre datos de B)", () => {
    it("no ve el hotel B en hotels", async () => {
      const { data } = await adminADb.from("hotels").select("id").eq("id", b.hotelId);
      expect(data ?? []).toHaveLength(0);
    });

    it("no ve profiles del hotel B", async () => {
      const { data } = await adminADb.from("profiles").select("id").eq("hotel_id", b.hotelId);
      expect(data ?? []).toHaveLength(0);
    });

    it("no ve áreas, plantillas ni preguntas del hotel B", async () => {
      const areas = await adminADb.from("areas").select("id").eq("hotel_id", b.hotelId);
      const templates = await adminADb
        .from("audit_templates")
        .select("id")
        .eq("id", b.template.templateId);
      const questions = await adminADb
        .from("audit_questions")
        .select("id")
        .in("id", b.template.questionIds);

      expect(areas.data ?? []).toHaveLength(0);
      expect(templates.data ?? []).toHaveLength(0);
      expect(questions.data ?? []).toHaveLength(0);
    });

    it("no ve runs ni respuestas del hotel B", async () => {
      const runs = await adminADb.from("audit_runs").select("id").eq("id", b.runId);
      const answers = await adminADb
        .from("audit_answers")
        .select("id")
        .eq("audit_run_id", b.runId);

      expect(runs.data ?? []).toHaveLength(0);
      expect(answers.data ?? []).toHaveLength(0);
    });

    it("no ve acciones correctivas del hotel B", async () => {
      const { data } = await adminADb
        .from("audit_corrective_actions")
        .select("id")
        .eq("hotel_id", b.hotelId);
      expect(data ?? []).toHaveLength(0);
    });

    it("sí ve sus propios datos (sanity check de que la sesión funciona)", async () => {
      const hotels = await adminADb.from("hotels").select("id").eq("id", a.hotelId);
      const runs = await adminADb.from("audit_runs").select("id").eq("id", a.runId);
      expect(hotels.data).toHaveLength(1);
      expect(runs.data).toHaveLength(1);
    });
  });

  describe("escrituras cruzadas (admin de A sobre hotel B)", () => {
    it("no puede crear áreas en el hotel B", async () => {
      const { data, error } = await adminADb
        .from("areas")
        .insert({ hotel_id: b.hotelId, name: bed.label("Área intrusa") })
        .select("id");

      expect(data ?? []).toHaveLength(0);
      expect(error?.code).toBe("42501");
    });

    it("no puede modificar profiles del hotel B (0 filas afectadas)", async () => {
      const { data } = await adminADb
        .from("profiles")
        .update({ role: "auditor" })
        .eq("id", b.admin.id)
        .select("id");
      expect(data ?? []).toHaveLength(0);

      const { data: intact } = await bed.admin
        .from("profiles")
        .select("role")
        .eq("id", b.admin.id)
        .single();
      expect(intact?.role).toBe("admin");
    });

    it("no puede tocar runs del hotel B (0 filas afectadas)", async () => {
      const { data } = await adminADb
        .from("audit_runs")
        .update({ notes: "intrusión" })
        .eq("id", b.runId)
        .select("id");
      expect(data ?? []).toHaveLength(0);
    });

    it("no puede falsear respuestas de runs del hotel B", async () => {
      const { data } = await adminADb
        .from("audit_answers")
        .update({ result: "PASS", answer: "PASS" })
        .eq("audit_run_id", b.runId)
        .select("id");
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("auditor de A", () => {
    it("listar runs sin filtro solo devuelve runs de su hotel", async () => {
      const { data, error } = await auditorADb.from("audit_runs").select("id, hotel_id");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.every((r) => r.hotel_id === a.hotelId)).toBe(true);
    });

    it("no ve el run del hotel B aunque conozca su id", async () => {
      const { data } = await auditorADb.from("audit_runs").select("id").eq("id", b.runId);
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("guards de hotel en los RPCs server-side", () => {
    it("submit_audit_run rechaza a un actor de A sobre un run de B (FORBIDDEN_HOTEL)", async () => {
      const draftB = await bed.startRunOk({
        hotelId: b.hotelId,
        areaId: b.areaId,
        templateId: b.template.templateId,
        actorId: b.admin.id,
      });

      const res = await bed.submitRun(draftB, a.admin.id);
      expect(res.ok).toBe(false);
      expect(res.code).toBe("FORBIDDEN_HOTEL");

      const { data: run } = await bed.admin
        .from("audit_runs")
        .select("status")
        .eq("id", draftB)
        .single();
      expect(run?.status).toBe("draft"); // intacto
    });

    it("start_audit_run rechaza mezclar área de B con scope de hotel A (AREA_OUT_OF_SCOPE)", async () => {
      const res = await bed.startRun({
        hotelId: a.hotelId,
        areaId: b.areaId,
        templateId: b.template.templateId,
        actorId: a.admin.id,
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("AREA_OUT_OF_SCOPE");
    });
  });

  describe("agregados por hotel", () => {
    it("rpc_team_summary_v2 de A no cuenta auditorías de B", async () => {
      const { data, error } = await bed.admin.rpc("rpc_team_summary_v2", {
        p_hotel_id: a.hotelId,
        p_period: "monthly",
        p_user_id: a.admin.id,
      });
      expect(error).toBeNull();

      const payload = data as any;
      // Tenant A solo tiene 1 auditoría enviada; las de B no deben aparecer.
      expect(payload.summary.total_audits_done).toBe(1);
      const leaderboard: any[] = payload.leaderboard ?? [];
      expect(leaderboard.some((r) => r.auditor_user_id === b.auditor.id)).toBe(false);
    });
  });
});