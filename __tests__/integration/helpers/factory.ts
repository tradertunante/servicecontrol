import { randomUUID } from "crypto";
import { adminClient, must, type Db } from "./clients";
import { purgeHotel, deleteTemplateTrees } from "./purge";
import { TEST_EMAIL_DOMAIN, TEST_NAME_PREFIX } from "./env";
import type { Database } from "@/lib/types/database";

type QuestionSpec = {
  text?: string;
  active?: boolean;
  commentRequirement?: "never" | "if_fail" | "always";
  photoRequirement?: "never" | "if_fail" | "always";
  correctiveFlow?: "training_only" | "non_operational" | "mixed";
  responsibleDepartment?: "engineering" | "systems" | null;
  ownerDepartment?: "engineering" | "it" | "systems" | null;
  blocksReaudit?: boolean;
};

export type TestTemplate = {
  templateId: string;
  sectionId: string;
  questionIds: string[];
};

export type TestUser = {
  id: string;
  email: string;
  password: string;
  role: string;
};

export type SubmitResult = {
  ok: boolean;
  code: string;
  message: string;
  data: any;
  error: any;
  meta: any;
};

/**
 * Fábrica de datos de test con tracking de todo lo creado.
 * Cada suite instancia su propio TestBed; `cleanup()` borra todo en orden
 * inverso de dependencias, por lo que los tests son idempotentes aunque
 * una ejecución anterior haya fallado a mitad (ver además globalSetup sweep).
 */
export class TestBed {
  readonly runTag = randomUUID().slice(0, 8);
  readonly admin: Db = adminClient();

  private hotelIds: string[] = [];
  private authUserIds: string[] = [];
  private globalTemplateIds: string[] = [];
  private globalPackIds: string[] = [];
  private trialLeadEmails: string[] = [];
  private userCounter = 0;

  label(name: string): string {
    return `${TEST_NAME_PREFIX}[${this.runTag}] ${name}`;
  }

  // ── Hoteles y áreas ────────────────────────────────────────────────────────

  async createHotel(name = "Hotel"): Promise<string> {
    const row = must(
      await this.admin
        .from("hotels")
        .insert({ name: this.label(name) })
        .select("id")
        .single(),
      "crear hotel"
    );
    this.hotelIds.push(row.id);
    return row.id;
  }

  async createArea(hotelId: string, name = "Área", active = true): Promise<string> {
    const row = must(
      await this.admin
        .from("areas")
        .insert({ hotel_id: hotelId, name: this.label(name), active })
        .select("id")
        .single(),
      "crear área"
    );
    return row.id;
  }

  // ── Usuarios (auth + profile vía trigger) ──────────────────────────────────

  async createUser(opts: {
    hotelId: string | null;
    role: string;
    active?: boolean;
    fullName?: string;
    /** Si el trigger de sync no creó el profile, lo upsertea (las suites que
     *  no prueban el trigger no deben fallar en cascada por él). */
    ensureProfile?: boolean;
  }): Promise<TestUser> {
    this.userCounter += 1;
    const email = `it.${this.runTag}.u${this.userCounter}@${TEST_EMAIL_DOMAIN}`;
    const password = `It-${this.runTag}-u${this.userCounter}!42aB`;

    const { data, error } = await this.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: opts.fullName ?? this.label(`user ${opts.role}`),
        role: opts.role,
        hotel_id: opts.hotelId,
        active: opts.active ?? true,
      },
    });
    if (error || !data.user) {
      throw new Error(`crear auth user (${opts.role}): ${error?.message ?? "sin usuario"}`);
    }
    this.authUserIds.push(data.user.id);

    if (opts.ensureProfile !== false) {
      const { data: profile } = await this.admin
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!profile) {
        must(
          await this.admin
            .from("profiles")
            .upsert({
              id: data.user.id,
              email,
              full_name: opts.fullName ?? this.label(`user ${opts.role}`),
              role: opts.role,
              hotel_id: opts.hotelId,
              active: opts.active ?? true,
            })
            .select("id")
            .single(),
          "upsert profile fallback"
        );
      }
    }

    return { id: data.user.id, email, password, role: opts.role };
  }

  async grantAreaAccess(userId: string, hotelId: string, areaId: string): Promise<void> {
    must(
      await this.admin
        .from("user_area_access")
        .insert({ user_id: userId, hotel_id: hotelId, area_id: areaId })
        .select("id")
        .single(),
      "grant area access"
    );
  }

  // ── Plantillas, secciones y preguntas ──────────────────────────────────────

  async createTemplate(opts: {
    hotelId: string;
    areaId: string;
    name?: string;
    active?: boolean;
    requireRoomNumber?: boolean;
    requireAuditedEmployee?: boolean;
    questions: QuestionSpec[];
  }): Promise<TestTemplate> {
    const template = must(
      await this.admin
        .from("audit_templates")
        .insert({
          hotel_id: opts.hotelId,
          area_id: opts.areaId,
          name: this.label(opts.name ?? "Plantilla"),
          scope: "hotel",
          active: opts.active ?? true,
          require_room_number: opts.requireRoomNumber ?? false,
          require_audited_employee: opts.requireAuditedEmployee ?? false,
        })
        .select("id")
        .single(),
      "crear plantilla"
    );

    const { sectionId, questionIds } = await this.addSectionWithQuestions(
      template.id,
      opts.questions
    );
    return { templateId: template.id, sectionId, questionIds };
  }

  async addSectionWithQuestions(
    templateId: string,
    questions: QuestionSpec[],
    sectionName = "Sección 1"
  ): Promise<{ sectionId: string; questionIds: string[] }> {
    const section = must(
      await this.admin
        .from("audit_sections")
        .insert({
          audit_template_id: templateId,
          name: this.label(sectionName),
          order: 1,
          active: true,
        })
        .select("id")
        .single(),
      "crear sección"
    );

    const rows: Database["public"]["Tables"]["audit_questions"]["Insert"][] = questions.map(
      (q, i) => ({
        audit_section_id: section.id,
        text: this.label(q.text ?? `Pregunta ${i + 1}`),
        order: i + 1,
        active: q.active ?? true,
        comment_requirement: q.commentRequirement ?? "never",
        photo_requirement: q.photoRequirement ?? "never",
        corrective_flow: q.correctiveFlow ?? "training_only",
        responsible_department: q.responsibleDepartment ?? null,
        owner_department: q.ownerDepartment ?? null,
        blocks_reaudit_until_resolved: q.blocksReaudit ?? false,
      })
    );

    const inserted = must(
      await this.admin.from("audit_questions").insert(rows).select("id, order").order("order"),
      "crear preguntas"
    );
    return { sectionId: section.id, questionIds: inserted.map((r) => r.id) };
  }

  // ── Pack global estilo LHW ─────────────────────────────────────────────────

  async createGlobalPack(opts: {
    name?: string;
    templateName?: string;
    questions: QuestionSpec[];
  }): Promise<{ packId: string; globalTemplateId: string }> {
    const pack = must(
      await this.admin
        .from("global_audit_packs")
        .insert({
          name: this.label(opts.name ?? "LHW Pack"),
          business_type: "hotel",
          active: true,
        })
        .select("id")
        .single(),
      "crear pack global"
    );
    this.globalPackIds.push(pack.id);

    const template = must(
      await this.admin
        .from("audit_templates")
        .insert({
          hotel_id: null,
          area_id: null,
          name: this.label(opts.templateName ?? "CHECK OUT -LHW"),
          scope: "global",
          is_global: true,
          active: true,
        })
        .select("id")
        .single(),
      "crear plantilla global"
    );
    this.globalTemplateIds.push(template.id);

    await this.addSectionWithQuestions(template.id, opts.questions, "LHW Standards");

    must(
      await this.admin
        .from("global_audit_pack_templates")
        .insert({ pack_id: pack.id, audit_template_id: template.id, position: 1 })
        .select("pack_id")
        .single(),
      "vincular plantilla al pack"
    );

    return { packId: pack.id, globalTemplateId: template.id };
  }

  // ── Reglas del hotel ───────────────────────────────────────────────────────

  async setAuditRules(
    hotelId: string,
    rules: {
      autoReauditEnabled?: boolean;
      autoReauditThreshold?: number;
      autoReauditDelayDays?: number;
      requireTrainingBeforeReaudit?: boolean;
    }
  ): Promise<void> {
    must(
      await this.admin
        .from("hotel_audit_rules")
        .upsert({
          hotel_id: hotelId,
          auto_reaudit_enabled: rules.autoReauditEnabled ?? false,
          auto_reaudit_threshold: rules.autoReauditThreshold ?? 0,
          auto_reaudit_delay_days: rules.autoReauditDelayDays ?? 0,
          require_training_before_reaudit: rules.requireTrainingBeforeReaudit ?? false,
        })
        .select("hotel_id")
        .single(),
      "upsert hotel_audit_rules"
    );
  }

  /**
   * Asigna un target de auditorías a un usuario. rpc_team_summary solo agrega
   * runs de usuarios presentes en area_template_target_assignments.
   */
  async assignTarget(opts: {
    hotelId: string;
    areaId: string;
    templateId: string;
    userId: string;
    period?: "daily" | "weekly" | "monthly";
    targetCount?: number;
  }): Promise<void> {
    must(
      await this.admin
        .from("area_template_target_assignments")
        .insert({
          hotel_id: opts.hotelId,
          area_id: opts.areaId,
          audit_template_id: opts.templateId,
          user_id: opts.userId,
          period: opts.period ?? "monthly",
          target_count: opts.targetCount ?? 1,
          active: true,
        })
        .select("id")
        .single(),
      "asignar target"
    );
  }

  // ── Ciclo de auditoría (RPCs reales) ───────────────────────────────────────

  async startRun(opts: {
    hotelId: string;
    areaId: string;
    templateId: string;
    actorId: string;
    roomNumber?: string | null;
    channel?: string;
  }): Promise<SubmitResult> {
    const { data, error } = await this.admin.rpc("start_audit_run", {
      p_hotel_id: opts.hotelId,
      p_area_id: opts.areaId,
      p_template_id: opts.templateId,
      p_actor_user_id: opts.actorId,
      p_room_number: opts.roomNumber ?? undefined,
      p_audit_channel: opts.channel ?? "internal",
    });
    if (error) throw new Error(`rpc start_audit_run: ${error.message}`);
    return data as unknown as SubmitResult;
  }

  /** start_audit_run que debe salir bien; devuelve el run_id. */
  async startRunOk(opts: Parameters<TestBed["startRun"]>[0]): Promise<string> {
    const res = await this.startRun(opts);
    if (!res.ok) throw new Error(`start_audit_run falló: ${res.code} ${res.message}`);
    return res.data.run_id as string;
  }

  async setAnswer(
    runId: string,
    questionId: string,
    value: "PASS" | "FAIL" | "NA" | string,
    extras: { comment?: string | null; photoPath?: string | null } = {}
  ): Promise<void> {
    const update: Database["public"]["Tables"]["audit_answers"]["Update"] = {
      answer: value,
      result: value,
    };
    if ("comment" in extras) update.comment = extras.comment;
    if ("photoPath" in extras) update.photo_path = extras.photoPath;

    const rows = must(
      await this.admin
        .from("audit_answers")
        .update(update)
        .eq("audit_run_id", runId)
        .eq("question_id", questionId)
        .select("id"),
      "actualizar respuesta"
    );
    if (rows.length !== 1) {
      throw new Error(`setAnswer esperaba 1 fila, tocó ${rows.length}`);
    }
  }

  /**
   * Siembra respuestas para un run que no pasó por start_audit_run
   * (p.ej. una reauditoría autogenerada, que nace sin respuestas).
   */
  async seedAnswers(
    runId: string,
    questionIds: string[],
    value: "PASS" | "FAIL" | "NA" = "PASS"
  ): Promise<void> {
    must(
      await this.admin
        .from("audit_answers")
        .insert(
          questionIds.map((questionId) => ({
            audit_run_id: runId,
            question_id: questionId,
            answer: value,
            result: value,
          }))
        )
        .select("id"),
      "sembrar respuestas"
    );
  }

  async submitRun(runId: string, actorId: string): Promise<SubmitResult> {
    const { data, error } = await this.admin.rpc("submit_audit_run", {
      p_run_id: runId,
      p_actor_user_id: actorId,
    });
    if (error) throw new Error(`rpc submit_audit_run: ${error.message}`);
    return data as unknown as SubmitResult;
  }

  /** Atajo: arranca un run, responde todas las preguntas y lo envía. */
  async runFullAudit(opts: {
    hotelId: string;
    areaId: string;
    template: TestTemplate;
    actorId: string;
    answers: Record<string, "PASS" | "FAIL" | "NA">;
  }): Promise<{ runId: string; result: SubmitResult }> {
    const runId = await this.startRunOk({
      hotelId: opts.hotelId,
      areaId: opts.areaId,
      templateId: opts.template.templateId,
      actorId: opts.actorId,
    });
    for (const [questionId, value] of Object.entries(opts.answers)) {
      if (value !== "PASS") await this.setAnswer(runId, questionId, value);
    }
    const result = await this.submitRun(runId, opts.actorId);
    return { runId, result };
  }

  // ── trial_leads ────────────────────────────────────────────────────────────

  async createTrialLead(name: string, hotelName: string): Promise<{ email: string }> {
    const email = `it.${this.runTag}.lead.${this.trialLeadEmails.length}@${TEST_EMAIL_DOMAIN}`;
    must(
      await this.admin
        .from("trial_leads")
        .insert({ name: this.label(name), email, hotel_name: this.label(hotelName) })
        .select("id")
        .single(),
      "crear trial lead"
    );
    this.trialLeadEmails.push(email);
    return { email };
  }

  /** Registra un hotel creado fuera del TestBed (p.ej. por un RPC) para limpiarlo. */
  trackHotel(hotelId: string): void {
    this.hotelIds.push(hotelId);
  }

  // ── Limpieza ───────────────────────────────────────────────────────────────

  async cleanup(): Promise<void> {
    const admin = this.admin;
    const errors: string[] = [];

    // Usuarios auth primero: el trigger cleanup_profile_from_auth_user borra
    // profiles y user_area_access, que referencian hotels/areas.
    for (const userId of this.authUserIds) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      // Por si el trigger de cleanup no existe en este entorno:
      await admin.from("user_area_access").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
    }

    for (const hotelId of this.hotelIds) {
      errors.push(...(await purgeHotel(admin, hotelId)));
    }

    for (const packId of this.globalPackIds) {
      await admin.from("global_audit_pack_templates").delete().eq("pack_id", packId);
    }
    errors.push(...(await deleteTemplateTrees(admin, this.globalTemplateIds)));
    for (const packId of this.globalPackIds) {
      const res = await admin.from("global_audit_packs").delete().eq("id", packId);
      if (res.error) errors.push(`global_audit_packs: ${res.error.message}`);
    }

    if (this.trialLeadEmails.length > 0) {
      await admin.from("trial_leads").delete().in("email", this.trialLeadEmails);
    }

    if (errors.length > 0) {
      throw new Error(`cleanup incompleto (quedan datos de test):\n- ${errors.join("\n- ")}`);
    }
  }
}