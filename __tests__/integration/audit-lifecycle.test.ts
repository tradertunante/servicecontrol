/**
 * Flujo: creación, asignación y completado de auditorías.
 *
 * Cubre los dos RPCs transaccionales reales (start_audit_run / submit_audit_run):
 *  - Happy path: arranque con seed de respuestas, asignación a auditor, envío con score.
 *  - Idempotencia de submit (AUDIT_ALREADY_SUBMITTED).
 *  - Matriz de fallos: actor inexistente/inactivo/rol prohibido, área/plantilla
 *    fuera de scope o inactivas, canal inválido, respuestas faltantes o inválidas,
 *    comentario/foto/habitación/empleado requeridos, acceso de auditor no asignado.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { integrationEnabled } from "./helpers/env";
import { TestBed, type TestTemplate, type TestUser } from "./helpers/factory";
import { adminClient } from "./helpers/clients";

const suite = describe.skipIf(!integrationEnabled);

suite("Ciclo de vida de auditorías", () => {
  let bed: TestBed;
  let hotelId: string;
  let areaId: string;
  let template: TestTemplate;
  let admin: TestUser;
  let auditor: TestUser;
  let otherAuditor: TestUser;

  beforeAll(async () => {
    bed = new TestBed();
    hotelId = await bed.createHotel("Lifecycle");
    areaId = await bed.createArea(hotelId, "Recepción");
    template = await bed.createTemplate({
      hotelId,
      areaId,
      name: "Check-in estándar",
      questions: [
        { text: "Saludo en 30 segundos" },
        { text: "Verificación de identidad" },
        { text: "Pregunta desactivada", active: false },
      ],
    });
    admin = await bed.createUser({ hotelId, role: "admin" });
    auditor = await bed.createUser({ hotelId, role: "auditor" });
    otherAuditor = await bed.createUser({ hotelId, role: "auditor" });
    await bed.grantAreaAccess(auditor.id, hotelId, areaId);
  });

  afterAll(async () => {
    await bed.cleanup();
  });

  describe("start_audit_run", () => {
    it("crea un draft y siembra respuestas PASS solo para preguntas activas", async () => {
      const res = await bed.startRun({
        hotelId,
        areaId,
        templateId: template.templateId,
        actorId: auditor.id,
      });

      expect(res.ok).toBe(true);
      expect(res.code).toBe("AUDIT_STARTED");
      expect(res.data.seeded_answers).toBe(2); // la inactiva no se siembra

      const { data: run } = await adminClient()
        .from("audit_runs")
        .select("status, score, executed_by, hotel_id, area_id, audit_channel")
        .eq("id", res.data.run_id)
        .single();

      expect(run?.status).toBe("draft");
      expect(run?.score).toBeNull();
      expect(run?.executed_by).toBe(auditor.id);
      expect(run?.audit_channel).toBe("internal");

      const { data: answers } = await adminClient()
        .from("audit_answers")
        .select("question_id, result")
        .eq("audit_run_id", res.data.run_id);
      expect(answers).toHaveLength(2);
      expect(answers?.every((a) => a.result === "PASS")).toBe(true);
    });

    it("rechaza un actor inexistente (ACTOR_NOT_FOUND)", async () => {
      const res = await bed.startRun({
        hotelId,
        areaId,
        templateId: template.templateId,
        actorId: randomUUID(),
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("ACTOR_NOT_FOUND");
    });

    it("rechaza roles sin permiso de arranque (FORBIDDEN_ROLE)", async () => {
      const engineering = await bed.createUser({ hotelId, role: "engineering" });
      const res = await bed.startRun({
        hotelId,
        areaId,
        templateId: template.templateId,
        actorId: engineering.id,
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("FORBIDDEN_ROLE");
    });

    it("rechaza un canal de auditoría inválido (INVALID_AUDIT_CHANNEL)", async () => {
      const res = await bed.startRun({
        hotelId,
        areaId,
        templateId: template.templateId,
        actorId: admin.id,
        channel: "external",
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("INVALID_AUDIT_CHANNEL");
    });

    it("rechaza un área de otro hotel (AREA_OUT_OF_SCOPE)", async () => {
      const otherHotelId = await bed.createHotel("Lifecycle ajeno");
      const foreignAreaId = await bed.createArea(otherHotelId, "Área ajena");

      const res = await bed.startRun({
        hotelId,
        areaId: foreignAreaId,
        templateId: template.templateId,
        actorId: admin.id,
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("AREA_OUT_OF_SCOPE");
    });

    it("rechaza áreas y plantillas inactivas", async () => {
      const inactiveAreaId = await bed.createArea(hotelId, "Área inactiva", false);
      const resArea = await bed.startRun({
        hotelId,
        areaId: inactiveAreaId,
        templateId: template.templateId,
        actorId: admin.id,
      });
      expect(resArea.code).toBe("AREA_INACTIVE");

      const inactiveTemplate = await bed.createTemplate({
        hotelId,
        areaId,
        name: "Plantilla inactiva",
        active: false,
        questions: [{ text: "Q" }],
      });
      const resTpl = await bed.startRun({
        hotelId,
        areaId,
        templateId: inactiveTemplate.templateId,
        actorId: admin.id,
      });
      expect(resTpl.code).toBe("TEMPLATE_INACTIVE");
    });

    it("rechaza una plantilla de otra área (TEMPLATE_OUT_OF_SCOPE)", async () => {
      const secondAreaId = await bed.createArea(hotelId, "Spa");
      const res = await bed.startRun({
        hotelId,
        areaId: secondAreaId,
        templateId: template.templateId,
        actorId: admin.id,
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("TEMPLATE_OUT_OF_SCOPE");
    });
  });

  describe("asignación", () => {
    it("un auditor asignado (sin ser ejecutor) puede enviar la auditoría", async () => {
      const runId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: template.templateId,
        actorId: admin.id,
      });
      await adminClient()
        .from("audit_runs")
        .update({ assigned_auditor_id: auditor.id })
        .eq("id", runId);

      const res = await bed.submitRun(runId, auditor.id);
      expect(res.ok).toBe(true);
      expect(res.code).toBe("AUDIT_SUBMITTED");
    });

    it("un auditor no asignado ni ejecutor no puede enviar (FORBIDDEN_RUN_ACCESS)", async () => {
      const runId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: template.templateId,
        actorId: admin.id,
      });

      const res = await bed.submitRun(runId, otherAuditor.id);
      expect(res.ok).toBe(false);
      expect(res.code).toBe("FORBIDDEN_RUN_ACCESS");
    });

    it("un admin puede enviar cualquier run de su hotel", async () => {
      const runId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: template.templateId,
        actorId: auditor.id,
      });
      const res = await bed.submitRun(runId, admin.id);
      expect(res.ok).toBe(true);
    });
  });

  describe("submit_audit_run", () => {
    it("happy path: marca submitted, calcula score y devuelve el resumen", async () => {
      const runId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: template.templateId,
        actorId: auditor.id,
      });
      await bed.setAnswer(runId, template.questionIds[0], "FAIL", { comment: "Tardó 2 min" });

      const res = await bed.submitRun(runId, auditor.id);

      expect(res.ok).toBe(true);
      expect(res.code).toBe("AUDIT_SUBMITTED");
      expect(res.data.summary).toMatchObject({
        total_questions: 2,
        pass_count: 1,
        fail_count: 1,
        na_count: 0,
        denominator: 2,
      });
      expect(Number(res.data.run.score)).toBe(50);

      const { data: run } = await adminClient()
        .from("audit_runs")
        .select("status, score")
        .eq("id", runId)
        .single();
      expect(run?.status).toBe("submitted");
      expect(Number(run?.score)).toBe(50);
    });

    it("es idempotente: reenviar devuelve AUDIT_ALREADY_SUBMITTED sin tocar el score", async () => {
      const runId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: template.templateId,
        actorId: auditor.id,
      });
      const first = await bed.submitRun(runId, auditor.id);
      expect(first.ok).toBe(true);
      const firstScore = Number(first.data.run.score);

      const second = await bed.submitRun(runId, auditor.id);
      expect(second.ok).toBe(true);
      expect(second.code).toBe("AUDIT_ALREADY_SUBMITTED");
      expect(second.meta.idempotent).toBe(true);
      expect(Number(second.data.run.score)).toBe(firstScore);
    });

    it("rechaza un run inexistente (RUN_NOT_FOUND)", async () => {
      const res = await bed.submitRun(randomUUID(), admin.id);
      expect(res.ok).toBe(false);
      expect(res.code).toBe("RUN_NOT_FOUND");
    });

    it("rechaza estados no enviables (RUN_INVALID_STATUS)", async () => {
      const runId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: template.templateId,
        actorId: auditor.id,
      });
      await adminClient().from("audit_runs").update({ status: "cancelled" }).eq("id", runId);

      const res = await bed.submitRun(runId, admin.id);
      expect(res.ok).toBe(false);
      expect(res.code).toBe("RUN_INVALID_STATUS");
    });

    it("rechaza actores inactivos (ACTOR_INACTIVE)", async () => {
      const inactive = await bed.createUser({ hotelId, role: "admin", active: false });
      const runId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: template.templateId,
        actorId: admin.id,
      });
      const res = await bed.submitRun(runId, inactive.id);
      expect(res.ok).toBe(false);
      expect(res.code).toBe("ACTOR_INACTIVE");
    });

    it("detecta respuestas faltantes para preguntas activas (MISSING_ANSWER)", async () => {
      const runId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: template.templateId,
        actorId: auditor.id,
      });
      await adminClient()
        .from("audit_answers")
        .delete()
        .eq("audit_run_id", runId)
        .eq("question_id", template.questionIds[1]);

      const res = await bed.submitRun(runId, auditor.id);
      expect(res.ok).toBe(false);
      expect(res.code).toBe("MISSING_ANSWER");
      expect(res.error.question_id).toBe(template.questionIds[1]);
    });

    it("la BD rechaza valores de respuesta fuera de PASS/FAIL/NA (check constraint)", async () => {
      // La primera línea de defensa es audit_answers_answer_result_check:
      // el valor inválido ni siquiera llega al branch INVALID_ANSWER_VALUE del RPC.
      const runId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: template.templateId,
        actorId: auditor.id,
      });

      const { error } = await bed.admin
        .from("audit_answers")
        .update({ answer: "MAYBE", result: "MAYBE" })
        .eq("audit_run_id", runId)
        .eq("question_id", template.questionIds[0])
        .select("id");

      expect(error).not.toBeNull();
      expect(error?.code).toBe("23514"); // check_violation
      expect(error?.message).toContain("audit_answers_answer_result_check");
    });

    it("exige comentario en FAIL cuando comment_requirement = if_fail", async () => {
      const strict = await bed.createTemplate({
        hotelId,
        areaId,
        name: "Comentario obligatorio",
        questions: [{ text: "Q con comentario", commentRequirement: "if_fail" }],
      });
      const runId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: strict.templateId,
        actorId: auditor.id,
      });
      await bed.setAnswer(runId, strict.questionIds[0], "FAIL", { comment: "   " });

      const blocked = await bed.submitRun(runId, auditor.id);
      expect(blocked.code).toBe("MISSING_REQUIRED_COMMENT");

      await bed.setAnswer(runId, strict.questionIds[0], "FAIL", { comment: "Detalle real" });
      const ok = await bed.submitRun(runId, auditor.id);
      expect(ok.ok).toBe(true);
    });

    it("exige foto cuando photo_requirement = always", async () => {
      const strict = await bed.createTemplate({
        hotelId,
        areaId,
        name: "Foto obligatoria",
        questions: [{ text: "Q con foto", photoRequirement: "always" }],
      });
      const runId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: strict.templateId,
        actorId: auditor.id,
      });

      const blocked = await bed.submitRun(runId, auditor.id);
      expect(blocked.code).toBe("MISSING_REQUIRED_PHOTO");

      await bed.setAnswer(runId, strict.questionIds[0], "PASS", {
        photoPath: `it/${bed.runTag}/evidence.jpg`,
      });
      const ok = await bed.submitRun(runId, auditor.id);
      expect(ok.ok).toBe(true);
    });

    it("exige número de habitación cuando la plantilla lo requiere", async () => {
      const roomTpl = await bed.createTemplate({
        hotelId,
        areaId,
        name: "Habitación requerida",
        requireRoomNumber: true,
        questions: [{ text: "Q" }],
      });
      const runId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: roomTpl.templateId,
        actorId: auditor.id,
        roomNumber: null,
      });

      const blocked = await bed.submitRun(runId, auditor.id);
      expect(blocked.code).toBe("ROOM_NUMBER_REQUIRED");

      await adminClient().from("audit_runs").update({ room_number: "1207" }).eq("id", runId);
      const ok = await bed.submitRun(runId, auditor.id);
      expect(ok.ok).toBe(true);
    });

    it("exige colaborador auditado cuando la plantilla lo requiere", async () => {
      const employeeTpl = await bed.createTemplate({
        hotelId,
        areaId,
        name: "Empleado requerido",
        requireAuditedEmployee: true,
        questions: [{ text: "Q" }],
      });
      const runId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: employeeTpl.templateId,
        actorId: auditor.id,
      });

      const blocked = await bed.submitRun(runId, auditor.id);
      expect(blocked.ok).toBe(false);
      expect(blocked.code).toBe("AUDITED_EMPLOYEE_REQUIRED");
    });

    it("rechaza plantillas sin preguntas activas (NO_ACTIVE_QUESTIONS)", async () => {
      const emptyTpl = await bed.createTemplate({
        hotelId,
        areaId,
        name: "Sin preguntas activas",
        questions: [{ text: "Apagada", active: false }],
      });
      // start_audit_run no siembra nada; forzamos el run en draft directamente
      const runId = await bed.startRunOk({
        hotelId,
        areaId,
        templateId: emptyTpl.templateId,
        actorId: admin.id,
      });

      const res = await bed.submitRun(runId, admin.id);
      expect(res.ok).toBe(false);
      expect(res.code).toBe("NO_ACTIVE_QUESTIONS");
    });
  });
});