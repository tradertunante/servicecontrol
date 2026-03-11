"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuditAutosave } from "./useAuditAutosave";

export type AuditRunRow = {
  id: string;
  status: string | null;
  score: number | null;
  notes: string | null;
  executed_at: string | null;
  executed_by: string | null;
  audit_template_id: string;
  area_id: string;
  team_member_id: string | null;
  assigned_auditor_id: string | null;
  is_reaudit: boolean;
  parent_audit_run_id: string | null;
  origin_type: string | null;
  scheduled_for: string | null;
  requires_training: boolean;
  training_confirmed: boolean;
  ready_for_reaudit: boolean;
  blocking_issue_count: number;
};

export type TemplateRow = { id: string; name: string };

export type AreaRow = {
  id: string;
  name: string;
  type: string | null;
  hotel_id: string | null;
};

export type TeamMemberLite = {
  id: string;
  full_name: string;
  _outOfArea?: boolean;
};

export type SectionRow = {
  id: string;
  name: string;
  active: boolean | null;
  created_at: string | null;
};

export type RequirementType = "never" | "if_fail" | "always";
export type CorrectiveFlow = "training_only" | "non_operational" | "mixed";
export type ResponsibleDepartment = "engineering" | "systems" | null;

export type QuestionRow = {
  id: string;
  audit_section_id: string;
  text: string;
  weight: number | null;
  photo_requirement: RequirementType;
  comment_requirement: RequirementType;
  signature_requirement: RequirementType;
  active: boolean;
  order: number | null;
  created_at: string | null;
  tag?: string | null;
  classification?: string | null;
  corrective_flow: CorrectiveFlow;
  responsible_department: ResponsibleDepartment;
  blocks_reaudit_until_resolved: boolean;
};

export type AnswerValue = "PASS" | "FAIL" | "NA";

export type AnswerRow = {
  id: string;
  audit_run_id: string;
  question_id: string;
  answer: AnswerValue | null;
  result: AnswerValue | null;
  comment: string | null;
  photo_path: string | null;
};

type SubmitAuditResponse = {
  ok: boolean;
  code: string;
  message: string;
  data?: {
    run?: {
      id: string;
      status: string;
      score: number | null;
      is_reaudit: boolean;
    };
  } | null;
};

function toRequirement(value: unknown): RequirementType {
  if (value === "if_fail" || value === "always") return value;
  return "never";
}

function makeDraftAnswer(runId: string, questionId: string, current?: AnswerRow | null): AnswerRow {
  return {
    id: current?.id ?? "",
    audit_run_id: runId,
    question_id: questionId,
    answer: current?.answer ?? "PASS",
    result: current?.result ?? "PASS",
    comment: current?.comment ?? null,
    photo_path: current?.photo_path ?? null,
  };
}

function shouldShowField(requirement: RequirementType, isFail: boolean): boolean {
  if (requirement === "always") return true;
  if (requirement === "if_fail") return isFail;
  return false;
}

export function useAuditSession(runId: string | undefined) {
  const router = useRouter();
  const { pendingCount, scheduleSave, flushAll } = useAuditAutosave();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [run, setRun] = useState<AuditRunRow | null>(null);
  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [area, setArea] = useState<AreaRow | null>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answersByQ, setAnswersByQ] = useState<Record<string, AnswerRow>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMemberLite[]>([]);
  const [selectedMember, setSelectedMember] = useState("");

  const saving = pendingCount > 0;
  const submitted = (run?.status ?? "") === "submitted";

  useEffect(() => {
    if (!runId) return;

    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push("/login");
          return;
        }

        const { data: runData, error: runError } = await supabase
          .from("audit_runs")
          .select(
            "id,status,score,notes,executed_at,executed_by,audit_template_id,area_id,team_member_id,assigned_auditor_id,is_reaudit,parent_audit_run_id,origin_type,scheduled_for,requires_training,training_confirmed,ready_for_reaudit,blocking_issue_count"
          )
          .eq("id", runId)
          .single();

        if (runError || !runData) {
          throw runError ?? new Error("Auditoría no encontrada.");
        }

        const currentRun = runData as AuditRunRow;
        if (!alive) return;

        setRun(currentRun);
        setSelectedMember(currentRun.team_member_id ?? "");

        const [{ data: templateData, error: templateError }, { data: areaData, error: areaError }] =
          await Promise.all([
            supabase.from("audit_templates").select("id,name").eq("id", currentRun.audit_template_id).single(),
            supabase.from("areas").select("id,name,type,hotel_id").eq("id", currentRun.area_id).single(),
          ]);

        if (templateError || !templateData) throw templateError ?? new Error("Plantilla no encontrada.");
        if (areaError || !areaData) throw areaError ?? new Error("Área no encontrada.");

        if (!alive) return;
        setTemplate(templateData as TemplateRow);
        setArea(areaData as AreaRow);

        const { data: linkData, error: linkError } = await supabase
          .from("team_member_areas")
          .select("team_member_id")
          .eq("area_id", currentRun.area_id);

        if (linkError) throw linkError;

        const linkedTeamMemberIds = Array.from(
          new Set((linkData ?? []).map((entry: { team_member_id: string | null }) => entry.team_member_id).filter(Boolean))
        ) as string[];

        let nextTeamMembers: TeamMemberLite[] = [];
        if (linkedTeamMemberIds.length > 0) {
          let query = supabase
            .from("team_members")
            .select("id,full_name")
            .eq("active", true)
            .in("id", linkedTeamMemberIds)
            .order("full_name", { ascending: true });

          const hotelId = (areaData as AreaRow).hotel_id;
          if (hotelId) {
            query = query.eq("hotel_id", hotelId);
          }

          const { data: teamData, error: teamError } = await query;
          if (teamError) throw teamError;
          nextTeamMembers = (teamData ?? []) as TeamMemberLite[];
        }

        if (currentRun.team_member_id && !nextTeamMembers.some((member) => member.id === currentRun.team_member_id)) {
          const { data: fallbackMember, error: fallbackError } = await supabase
            .from("team_members")
            .select("id,full_name")
            .eq("id", currentRun.team_member_id)
            .maybeSingle();

          if (!fallbackError && fallbackMember) {
            nextTeamMembers = [{ ...(fallbackMember as TeamMemberLite), _outOfArea: true }, ...nextTeamMembers];
          }
        }

        if (!alive) return;
        setTeamMembers(nextTeamMembers);

        const { data: sectionData, error: sectionError } = await supabase
          .from("audit_sections")
          .select("id,name,active,created_at")
          .eq("audit_template_id", currentRun.audit_template_id)
          .eq("active", true)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });

        if (sectionError) throw sectionError;
        const activeSections = (sectionData ?? []) as SectionRow[];

        if (!alive) return;
        setSections(activeSections);

        const sectionIds = activeSections.map((section) => section.id);
        let nextQuestions: QuestionRow[] = [];
        if (sectionIds.length > 0) {
          const { data: questionData, error: questionError } = await supabase
            .from("audit_questions")
            .select(
              "id,audit_section_id,text,weight,photo_requirement,comment_requirement,signature_requirement,active,order,created_at,tag,classification,corrective_flow,responsible_department,blocks_reaudit_until_resolved"
            )
            .in("audit_section_id", sectionIds)
            .eq("active", true)
            .order("audit_section_id", { ascending: true })
            .order("order", { ascending: true })
            .order("created_at", { ascending: true })
            .order("id", { ascending: true });

          if (questionError) throw questionError;

          nextQuestions = (questionData ?? []).map((question: any) => ({
            ...question,
            photo_requirement: toRequirement(question.photo_requirement),
            comment_requirement: toRequirement(question.comment_requirement),
            signature_requirement: toRequirement(question.signature_requirement),
            corrective_flow:
              question.corrective_flow === "non_operational" || question.corrective_flow === "mixed"
                ? question.corrective_flow
                : "training_only",
            responsible_department:
              question.responsible_department === "engineering" || question.responsible_department === "systems"
                ? question.responsible_department
                : null,
            blocks_reaudit_until_resolved: !!question.blocks_reaudit_until_resolved,
          })) as QuestionRow[];
        }

        if (!alive) return;
        setQuestions(nextQuestions);

        const { data: answerData, error: answerError } = await supabase
          .from("audit_answers")
          .select("id,audit_run_id,question_id,answer,result,comment,photo_path")
          .eq("audit_run_id", runId);

        if (answerError) throw answerError;

        const answerMap: Record<string, AnswerRow> = {};
        for (const answer of (answerData ?? []) as any[]) {
          if (!answer?.question_id) continue;
          answerMap[answer.question_id] = {
            id: answer.id,
            audit_run_id: answer.audit_run_id,
            question_id: answer.question_id,
            answer: (answer.answer ?? null) as AnswerValue | null,
            result: (answer.result ?? null) as AnswerValue | null,
            comment: answer.comment ?? null,
            photo_path: answer.photo_path ?? null,
          };
        }

        const seedPayload = nextQuestions
          .filter((question) => !answerMap[question.id] || !answerMap[question.id]?.answer || !answerMap[question.id]?.result)
          .map((question) => ({
            audit_run_id: runId,
            question_id: question.id,
            answer: (answerMap[question.id]?.answer ?? "PASS") as AnswerValue,
            result: (answerMap[question.id]?.result ?? "PASS") as AnswerValue,
            comment: answerMap[question.id]?.comment ?? null,
            photo_path: answerMap[question.id]?.photo_path ?? null,
          }));

        if (seedPayload.length > 0) {
          const { data: seededAnswers, error: seedError } = await supabase
            .from("audit_answers")
            .upsert(seedPayload, { onConflict: "audit_run_id,question_id" })
            .select("id,audit_run_id,question_id,answer,result,comment,photo_path");

          if (seedError) throw seedError;

          for (const answer of seededAnswers ?? []) {
            answerMap[(answer as AnswerRow).question_id] = answer as AnswerRow;
          }
        }

        if (!alive) return;
        setAnswersByQ(answerMap);
        setLoading(false);
      } catch (sessionError: any) {
        if (!alive) return;
        setError(sessionError?.message ?? "Error cargando auditoría.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, runId]);

  const totals = useMemo(() => {
    const total = questions.length;
    let answered = 0;
    let fail = 0;
    let na = 0;

    for (const question of questions) {
      const answer = answersByQ[question.id];
      const value = (answer?.answer ?? answer?.result ?? null) as AnswerValue | null;
      if (!value) continue;
      answered += 1;
      if (value === "FAIL") fail += 1;
      if (value === "NA") na += 1;
    }

    const denom = Math.max(0, total - na);
    const pass = Math.max(0, denom - fail);
    const score = denom === 0 ? null : Math.round((pass / denom) * 100 * 10) / 10;

    return { total, answered, fail, na, denom, pass, score };
  }, [answersByQ, questions]);

  const groupedQuestions = useMemo(() => {
    const grouped: Record<string, QuestionRow[]> = {};
    for (const question of questions) {
      if (!grouped[question.audit_section_id]) {
        grouped[question.audit_section_id] = [];
      }
      grouped[question.audit_section_id]!.push(question);
    }
    return grouped;
  }, [questions]);

  async function persistAnswerDraft(questionId: string, draft: AnswerRow) {
    if (!runId) return;

    const payload = {
      audit_run_id: runId,
      question_id: questionId,
      answer: draft.answer,
      result: draft.result,
      comment: draft.comment,
      photo_path: draft.photo_path,
    };

    const { data, error } = await supabase
      .from("audit_answers")
      .upsert(payload, { onConflict: "audit_run_id,question_id" })
      .select("id,audit_run_id,question_id,answer,result,comment,photo_path")
      .single();

    if (error || !data) {
      throw error ?? new Error("No se pudo guardar.");
    }

    setAnswersByQ((prev) => ({
      ...prev,
      [questionId]: data as AnswerRow,
    }));
  }

  function updateAnswerDraft(questionId: string, updater: (draft: AnswerRow) => AnswerRow) {
    if (!runId) return null;

    let nextDraft: AnswerRow | null = null;
    setAnswersByQ((prev) => {
      const current = prev[questionId];
      nextDraft = updater(makeDraftAnswer(runId, questionId, current));
      return {
        ...prev,
        [questionId]: nextDraft!,
      };
    });
    return nextDraft;
  }

  function setAnswer(questionId: string, nextValue: AnswerValue) {
    if (!runId || submitted) return;

    setError(null);
    const nextDraft = updateAnswerDraft(questionId, (draft) => ({
      ...draft,
      answer: nextValue,
      result: nextValue,
    }));

    if (!nextDraft) return;

    scheduleSave(`answer:${questionId}`, async () => {
      try {
        await persistAnswerDraft(questionId, nextDraft);
      } catch (saveError: any) {
        setError(saveError?.message ?? "No se pudo guardar la respuesta.");
      }
    });
  }

  function setComment(questionId: string, comment: string) {
    if (!runId || submitted) return;

    setError(null);
    const nextDraft = updateAnswerDraft(questionId, (draft) => ({
      ...draft,
      comment,
    }));

    if (!nextDraft) return;

    scheduleSave(`answer:${questionId}`, async () => {
      try {
        await persistAnswerDraft(questionId, nextDraft);
      } catch (saveError: any) {
        setError(saveError?.message ?? "No se pudo guardar el comentario.");
      }
    });
  }

  async function saveTeamMember(nextId: string) {
    if (!run || submitted) return;

    setSavingMember(true);
    setError(null);

    try {
      const value = nextId || null;
      const { error: updateError } = await supabase
        .from("audit_runs")
        .update({ team_member_id: value })
        .eq("id", run.id);

      if (updateError) throw updateError;

      setSelectedMember(nextId);
      setRun((prev) => (prev ? { ...prev, team_member_id: value } : prev));
    } catch (memberError: any) {
      setError(memberError?.message ?? "No se pudo asignar el colaborador.");
    } finally {
      setSavingMember(false);
    }
  }

  async function uploadPhoto(questionId: string, file: File) {
    if (!runId || submitted) return;

    const current = answersByQ[questionId];
    if (!current) {
      setError("No existe respuesta para esta pregunta.");
      return;
    }

    const question = questions.find((entry) => entry.id === questionId);
    const selectedValue = ((current.answer ?? current.result) ?? "PASS") as AnswerValue;
    const allowPhoto = question?.photo_requirement === "always" || selectedValue === "FAIL";
    if (!allowPhoto) {
      setError("Para subir foto, marca FAIL o usa una pregunta con foto obligatoria.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const extension = file.name.split(".").pop() || "jpg";
      const fileName = `${runId}_${questionId}_${timestamp}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("audit-photos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("audit-photos").getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;
      const nextDraft = makeDraftAnswer(runId, questionId, current);
      nextDraft.photo_path = publicUrl;

      setAnswersByQ((prev) => ({
        ...prev,
        [questionId]: {
          ...nextDraft,
        },
      }));

      await persistAnswerDraft(questionId, nextDraft);
    } catch (photoError: any) {
      setError(photoError?.message ?? "No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(questionId: string) {
    if (!runId || submitted) return;

    const current = answersByQ[questionId];
    if (!current?.photo_path) return;

    setError(null);
    try {
      const fileName = current.photo_path.split("/").pop() ?? "";
      if (fileName) {
        const { error: storageError } = await supabase.storage.from("audit-photos").remove([fileName]);
        if (storageError) {
          console.warn("Error eliminando de Storage:", storageError);
        }
      }

      const nextDraft = makeDraftAnswer(runId, questionId, current);
      nextDraft.photo_path = null;

      setAnswersByQ((prev) => ({
        ...prev,
        [questionId]: nextDraft,
      }));

      await persistAnswerDraft(questionId, nextDraft);
    } catch (photoError: any) {
      setError(photoError?.message ?? "No se pudo eliminar la foto.");
    }
  }

  async function submitRun() {
    if (!run || !area || submitted) return;

    for (const question of questions) {
      const answer = answersByQ[question.id];
      if (!answer) continue;

      const value = ((answer.answer ?? answer.result) ?? "PASS") as AnswerValue;
      const shouldValidateComment =
        question.comment_requirement === "always" ||
        (question.comment_requirement === "if_fail" && value === "FAIL");
      const shouldValidatePhoto =
        question.photo_requirement === "always" ||
        (question.photo_requirement === "if_fail" && value === "FAIL");

      if (shouldValidateComment && !(answer.comment ?? "").trim()) {
        setError(`Falta comentario en: "${question.text}"`);
        return;
      }

      if (shouldValidatePhoto && !(answer.photo_path ?? "").trim()) {
        setError(`Falta foto en: "${question.text}"`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      await flushAll();

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error("Sesion invalida.");
      }

      const response = await fetch("/api/audits/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ run_id: run.id }),
      });

      const payload = (await response.json().catch(() => null)) as SubmitAuditResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "No se pudo enviar la auditoría.");
      }

      setRun((prev) =>
        prev
          ? {
              ...prev,
              status: payload.data?.run?.status ?? "submitted",
              score: payload.data?.run?.score ?? prev.score,
            }
          : prev,
      );

      router.push(`/audits/${run.id}/view`);
    } catch (submitError: any) {
      setError(submitError?.message ?? "No se pudo enviar la auditoría.");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    loading,
    saving,
    uploading,
    submitting,
    savingMember,
    error,
    submitted,
    run,
    template,
    area,
    sections,
    questions,
    groupedQuestions,
    answersByQ,
    teamMembers,
    selectedMember,
    totals,
    setAnswer,
    setComment,
    uploadPhoto,
    deletePhoto,
    saveTeamMember,
    submitRun,
    setSelectedMember,
    shouldShowField,
  };
}
