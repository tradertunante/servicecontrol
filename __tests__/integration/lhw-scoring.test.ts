/**
 * Flujo: scoring de estándares LHW y agregación.
 *
 * Los estándares LHW viven como plantillas globales dentro de un pack
 * (p.ej. "CHECK OUT -LHW") que se sincroniza a cada hotel. Aquí se cubre:
 *  - Auditoría end-to-end sobre una plantilla clonada del pack LHW.
 *  - Matemática del score: PASS/(total−NA)×100, redondeo a 2 decimales,
 *    exclusión de NA del denominador, score null si todo es NA.
 *  - Agregación: vista audit_run_summary, v_area_latest_score (último run del
 *    área) y rpc_team_summary_v2 (leaderboard con avg_score y totales).
 *  - Reauditorías automáticas por umbral (hotel_audit_rules) y sus estados:
 *    draft, pending_training, blocked_by_non_operational.
 *  - Acciones correctivas y backlog departamental generados por FAILs.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { integrationEnabled } from "./helpers/env";
import { TestBed, type TestTemplate, type TestUser } from "./helpers/factory";
import { adminClient } from "./helpers/clients";

const suite = describe.skipIf(!integrationEnabled);

suite("Scoring LHW y agregación", () => {
  let bed: TestBed;

  beforeAll(() => {
    bed = new TestBed();
  });

  afterAll(async () => {
    await bed.cleanup();
  });

  describe("auditoría sobre plantilla LHW sincronizada", () => {
    let hotelId: string;
    let areaId: string;
    let lhwTemplate: TestTemplate;
    let auditor: TestUser;

    beforeAll(async () => {
      hotelId = await bed.createHotel("LHW Scoring");
      areaId = await bed.createArea(hotelId, "Front Desk");
      auditor = await bed.createUser({ hotelId, role: "auditor" });

      const { packId } = await bed.createGlobalPack({
        templateName: "CHECK OUT -LHW",
        questions: [
          { text: "LHW 1: despedida personalizada" },
          { text: "LHW 2: factura correcta" },
          { text: "LHW 3: ofrecimiento de asistencia" },
          { text: "LHW 4: tiempo de espera < 5 min" },
        ],
      });
      const admin = adminClient();
      const sync = await admin.rpc("sync_global_audit_pack_to_hotel", {
        p_pack_id: packId,
        p_target_hotel_id: hotelId,
      });
      expect(sync.error).toBeNull();

      // El clon llega sin área: el setup del hotel se la asigna.
      const { data: cloned } = await admin
        .from("audit_templates")
        .select("id")
        .eq("hotel_id", hotelId)
        .eq("pack_id", packId)
        .single();
      await admin.from("audit_templates").update({ area_id: areaId }).eq("id", cloned!.id);

      const { data: sections } = await admin
        .from("audit_sections")
        .select("id")
        .eq("audit_template_id", cloned!.id);
      const { data: questions } = await admin
        .from("audit_questions")
        .select("id")
        .eq("audit_section_id", sections![0].id)
        .order("order");

      lhwTemplate = {
        templateId: cloned!.id,
        sectionId: sections![0].id,
        questionIds: questions!.map((q) => q.id),
      };
    });

    it("todo PASS sobre los estándares LHW → score 100", async () => {
      const { result } = await bed.runFullAudit({
        hotelId,
        areaId,
        template: lhwTemplate,
        actorId: auditor.id,
        answers: {},
      });
      expect(result.ok).toBe(true);
      expect(Number(result.data.run.score)).toBe(100);
      expect(result.data.summary.denominator).toBe(4);
    });

    it("1 FAIL de 4 estándares → 75.00", async () => {
      const { result } = await bed.runFullAudit({
        hotelId,
        areaId,
        template: lhwTemplate,
        actorId: auditor.id,
        answers: { [lhwTemplate.questionIds[0]]: "FAIL" },
      });
      expect(Number(result.data.run.score)).toBe(75);
      expect(result.data.summary).toMatchObject({
        total_questions: 4,
        pass_count: 3,
        fail_count: 1,
        na_count: 0,
        denominator: 4,
      });
    });

    it("los NA salen del denominador: 1 FAIL + 1 NA de 4 → 66.67 (redondeo)", async () => {
      const { result } = await bed.runFullAudit({
        hotelId,
        areaId,
        template: lhwTemplate,
        actorId: auditor.id,
        answers: {
          [lhwTemplate.questionIds[0]]: "FAIL",
          [lhwTemplate.questionIds[1]]: "NA",
        },
      });
      expect(result.data.summary).toMatchObject({
        denominator: 3,
        pass_count: 2,
        fail_count: 1,
        na_count: 1,
      });
      expect(Number(result.data.run.score)).toBeCloseTo(66.67, 2);
    });

    it("todo NA → score null (auditoría no puntuable)", async () => {
      const answers: Record<string, "NA"> = {};
      for (const q of lhwTemplate.questionIds) answers[q] = "NA";

      const { runId, result } = await bed.runFullAudit({
        hotelId,
        areaId,
        template: lhwTemplate,
        actorId: auditor.id,
        answers,
      });
      expect(result.ok).toBe(true);
      expect(result.data.run.score).toBeNull();
      expect(result.data.summary.denominator).toBe(0);

      const { data: run } = await adminClient()
        .from("audit_runs")
        .select("score, status")
        .eq("id", runId)
        .single();
      expect(run?.score).toBeNull();
      expect(run?.status).toBe("submitted");
    });
  });

  describe("agregación (vistas y rpc_team_summary_v2)", () => {
    let hotelId: string;
    let areaId: string;
    let template: TestTemplate;
    let manager: TestUser;
    let auditor: TestUser;
    let firstRunId: string;
    let secondRunId: string;

    beforeAll(async () => {
      // Hotel propio para que los agregados sean deterministas.
      hotelId = await bed.createHotel("LHW Agregación");
      areaId = await bed.createArea(hotelId, "Housekeeping");
      manager = await bed.createUser({ hotelId, role: "manager" });
      auditor = await bed.createUser({ hotelId, role: "auditor" });
      // Un caller manager solo agrega áreas de su user_area_access.
      await bed.grantAreaAccess(manager.id, hotelId, areaId);
      template = await bed.createTemplate({
        hotelId,
        areaId,
        name: "Estándares de limpieza",
        questions: [{ text: "Q1" }, { text: "Q2" }, { text: "Q3" }, { text: "Q4" }],
      });
      // rpc_team_summary solo agrega usuarios con target asignado en el periodo.
      await bed.assignTarget({
        hotelId,
        areaId,
        templateId: template.templateId,
        userId: auditor.id,
        period: "monthly",
        targetCount: 2,
      });

      // Run 1: 75 (1 FAIL de 4). Run 2: 100.
      const first = await bed.runFullAudit({
        hotelId,
        areaId,
        template,
        actorId: auditor.id,
        answers: { [template.questionIds[0]]: "FAIL" },
      });
      firstRunId = first.runId;
      const second = await bed.runFullAudit({
        hotelId,
        areaId,
        template,
        actorId: auditor.id,
        answers: {},
      });
      secondRunId = second.runId;
    });

    it("audit_run_summary refleja pass/fail/na y score_pct del run", async () => {
      const { data: summary } = await adminClient()
        .from("audit_run_summary")
        .select("pass_count, fail_count, na_count, score_pct")
        .eq("audit_run_id", firstRunId)
        .single();

      expect(summary?.pass_count).toBe(3);
      expect(summary?.fail_count).toBe(1);
      expect(summary?.na_count).toBe(0);
      expect(Number(summary?.score_pct)).toBe(75);
    });

    it("v_area_latest_score muestra el último run del área (no el primero)", async () => {
      const { data: latest } = await adminClient()
        .from("v_area_latest_score")
        .select("audit_run_id, score_pct")
        .eq("area_id", areaId)
        .single();

      expect(latest?.audit_run_id).toBe(secondRunId);
      expect(Number(latest?.score_pct)).toBe(100);
    });

    it("rpc_team_summary_v2 agrega los runs del periodo con avg_score por auditor", async () => {
      const { data, error } = await adminClient().rpc("rpc_team_summary_v2", {
        p_hotel_id: hotelId,
        p_period: "monthly",
        p_user_id: manager.id,
      });
      expect(error).toBeNull();

      const payload = data as any;
      expect(payload.summary.total_audits_done).toBe(2);

      const leaderboard: any[] = payload.leaderboard ?? [];
      const row = leaderboard.find((r) => r.auditor_user_id === auditor.id);
      expect(row).toBeDefined();
      expect(row.audits_done).toBe(2);
      expect(Number(row.avg_score)).toBeCloseTo(87.5, 1); // (75 + 100) / 2
    });

    it("rpc_team_summary_v2 rechaza periodos inválidos", async () => {
      const { error } = await adminClient().rpc("rpc_team_summary_v2", {
        p_hotel_id: hotelId,
        p_period: "quarterly",
        p_user_id: manager.id,
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Invalid p_period/i);
    });
  });

  describe("reauditorías automáticas por umbral", () => {
    let hotelId: string;
    let areaId: string;
    let template: TestTemplate;
    let auditor: TestUser;

    beforeAll(async () => {
      hotelId = await bed.createHotel("LHW Reaudit");
      areaId = await bed.createArea(hotelId, "Bar");
      auditor = await bed.createUser({ hotelId, role: "auditor" });
      template = await bed.createTemplate({
        hotelId,
        areaId,
        name: "Servicio de bar",
        questions: [{ text: "Q1" }, { text: "Q2" }],
      });
      await bed.setAuditRules(hotelId, {
        autoReauditEnabled: true,
        autoReauditThreshold: 90,
        autoReauditDelayDays: 2,
      });
    });

    it("score bajo el umbral crea reauditoría draft programada con delay", async () => {
      const { runId, result } = await bed.runFullAudit({
        hotelId,
        areaId,
        template,
        actorId: auditor.id,
        answers: { [template.questionIds[0]]: "FAIL" }, // 50 < 90
      });

      expect(result.data.reaudit.created).toBe(true);
      const reauditId = result.data.reaudit.run_id as string;

      const { data: reaudit } = await adminClient()
        .from("audit_runs")
        .select(
          "status, is_reaudit, parent_audit_run_id, origin_type, scheduled_for, assigned_auditor_id, score"
        )
        .eq("id", reauditId)
        .single();

      expect(reaudit?.is_reaudit).toBe(true);
      expect(reaudit?.parent_audit_run_id).toBe(runId);
      expect(reaudit?.origin_type).toBe("auto_below_threshold");
      expect(reaudit?.status).toBe("draft");
      expect(reaudit?.score).toBeNull();
      expect(reaudit?.assigned_auditor_id).toBe(auditor.id);

      const scheduled = new Date(reaudit!.scheduled_for!).getTime();
      const expected = Date.now() + 2 * 24 * 60 * 60 * 1000;
      expect(Math.abs(scheduled - expected)).toBeLessThan(10 * 60 * 1000); // ±10 min
    });

    it("score en o sobre el umbral no crea reauditoría", async () => {
      const { result } = await bed.runFullAudit({
        hotelId,
        areaId,
        template,
        actorId: auditor.id,
        answers: {}, // 100 >= 90
      });
      expect(result.data.reaudit.created).toBe(false);
      expect(result.data.reaudit.run_id).toBeNull();
    });

    it("una reauditoría suspendida no genera otra reauditoría (sin cascada)", async () => {
      const { result } = await bed.runFullAudit({
        hotelId,
        areaId,
        template,
        actorId: auditor.id,
        answers: { [template.questionIds[0]]: "FAIL" },
      });
      const reauditId = result.data.reaudit.run_id as string;

      // La reauditoría nace sin respuestas: se siembran al retomarla.
      await bed.seedAnswers(reauditId, template.questionIds);
      // Suspender también la reauditoría (FAIL → score 50 < 90).
      await bed.setAnswer(reauditId, template.questionIds[0], "FAIL");
      const reauditResult = await bed.submitRun(reauditId, auditor.id);

      expect(reauditResult.ok).toBe(true);
      expect(Number(reauditResult.data.run.score)).toBe(50);
      expect(reauditResult.data.run.is_reaudit).toBe(true);
      expect(reauditResult.data.reaudit.created).toBe(false);
    });

    it("con require_training_before_reaudit, la reauditoría nace en pending_training", async () => {
      await bed.setAuditRules(hotelId, {
        autoReauditEnabled: true,
        autoReauditThreshold: 90,
        autoReauditDelayDays: 0,
        requireTrainingBeforeReaudit: true,
      });

      const { result } = await bed.runFullAudit({
        hotelId,
        areaId,
        template,
        actorId: auditor.id,
        answers: { [template.questionIds[1]]: "FAIL" }, // training_only por defecto
      });
      const reauditId = result.data.reaudit.run_id as string;

      const { data: reaudit } = await adminClient()
        .from("audit_runs")
        .select("status, requires_training, ready_for_reaudit")
        .eq("id", reauditId)
        .single();

      expect(reaudit?.status).toBe("pending_training");
      expect(reaudit?.requires_training).toBe(true);
      expect(reaudit?.ready_for_reaudit).toBe(false);

      // Restaurar reglas para el resto de la suite.
      await bed.setAuditRules(hotelId, {
        autoReauditEnabled: true,
        autoReauditThreshold: 90,
        autoReauditDelayDays: 2,
      });
    });
  });

  describe("acciones correctivas y backlog departamental", () => {
    let hotelId: string;
    let areaId: string;
    let template: TestTemplate;
    let auditor: TestUser;

    beforeAll(async () => {
      hotelId = await bed.createHotel("LHW Correctivas");
      areaId = await bed.createArea(hotelId, "Habitaciones");
      auditor = await bed.createUser({ hotelId, role: "auditor" });
      template = await bed.createTemplate({
        hotelId,
        areaId,
        name: "Mantenimiento de habitación",
        questions: [
          {
            text: "Aire acondicionado funciona",
            correctiveFlow: "non_operational",
            responsibleDepartment: "engineering",
            blocksReaudit: true,
            ownerDepartment: "engineering",
          },
          { text: "TV operativa", ownerDepartment: "it" },
          { text: "Amenities completos" },
        ],
      });
      await bed.setAuditRules(hotelId, {
        autoReauditEnabled: true,
        autoReauditThreshold: 90,
      });
    });

    it("un FAIL non_operational de engineering crea acción correctiva bloqueante y la reauditoría nace bloqueada", async () => {
      const { runId, result } = await bed.runFullAudit({
        hotelId,
        areaId,
        template,
        actorId: auditor.id,
        answers: { [template.questionIds[0]]: "FAIL" },
      });

      expect(result.data.corrective_actions.created_count).toBe(1);
      expect(result.data.corrective_actions.blocking_count).toBe(1);

      const { data: actions } = await adminClient()
        .from("audit_corrective_actions")
        .select("status, assigned_department, blocks_reaudit, question_id, reaudit_run_id")
        .eq("audit_run_id", runId);

      expect(actions).toHaveLength(1);
      expect(actions?.[0]).toMatchObject({
        status: "open",
        assigned_department: "engineering",
        blocks_reaudit: true,
        question_id: template.questionIds[0],
      });

      const { data: reaudit } = await adminClient()
        .from("audit_runs")
        .select("status, blocking_issue_count")
        .eq("id", result.data.reaudit.run_id)
        .single();
      expect(reaudit?.status).toBe("blocked_by_non_operational");
      expect(reaudit?.blocking_issue_count).toBe(1);
      expect(actions?.[0]?.reaudit_run_id).toBe(result.data.reaudit.run_id);
    });

    it("un FAIL con owner_department crea ítem de backlog departamental (it)", async () => {
      const { runId } = await bed.runFullAudit({
        hotelId,
        areaId,
        template,
        actorId: auditor.id,
        answers: { [template.questionIds[1]]: "FAIL" },
      });

      const { data: backlog } = await adminClient()
        .from("department_backlog_items")
        .select("owner_department, status, question_id")
        .eq("audit_run_id", runId);

      expect(backlog).toHaveLength(1);
      expect(backlog?.[0]).toMatchObject({
        owner_department: "it",
        status: "open",
        question_id: template.questionIds[1],
      });
    });

    it("un FAIL training_only no genera acciones correctivas ni backlog", async () => {
      const { runId, result } = await bed.runFullAudit({
        hotelId,
        areaId,
        template,
        actorId: auditor.id,
        answers: { [template.questionIds[2]]: "FAIL" },
      });

      expect(result.data.corrective_actions.created_count).toBe(0);
      expect(result.data.corrective_actions.blocking_count).toBe(0);

      const { data: backlog } = await adminClient()
        .from("department_backlog_items")
        .select("id")
        .eq("audit_run_id", runId);
      expect(backlog ?? []).toHaveLength(0);
    });
  });
});