import "server-only";

type HistoricalQuestion = {
  id: string;
  code: string;
};

type HistoricalAnswerMap = Record<string, "PASS" | "FAIL" | "NA">;

type SupabaseAdminClient = ReturnType<typeof import("@/lib/supabaseAdmin").supabaseAdmin>;

function buildHistoricalNotes(input: {
  notes: string | null;
  auditor_email: string | null;
  employee_number: string | null;
}) {
  const parts = [input.notes?.trim() || ""].filter(Boolean);

  if (input.auditor_email?.trim()) {
    parts.push(`Historical auditor email: ${input.auditor_email.trim()}`);
  }

  if (input.employee_number?.trim()) {
    parts.push(`Historical employee number: ${input.employee_number.trim()}`);
  }

  const combined = parts.join("\n");
  return combined || null;
}

export async function createHistoricalRun({
  supabaseAdmin,
  hotel_id,
  area_id,
  template_id,
  executed_by,
  executed_at,
  auditor_email,
  employee_number,
  notes,
  score,
  questions,
  answers,
}: {
  supabaseAdmin: SupabaseAdminClient;
  hotel_id: string;
  area_id: string;
  template_id: string;
  executed_by: string;
  executed_at: string;
  auditor_email: string | null;
  employee_number: string | null;
  notes: string | null;
  score: number;
  questions: HistoricalQuestion[];
  answers: HistoricalAnswerMap;
}) {
  if (!hotel_id) throw new Error("hotel_id missing");
  if (!area_id) throw new Error("area_id missing");
  if (!template_id) throw new Error("template_id missing");
  if (!executed_by) throw new Error("executed_by missing");

  const historicalNotes = buildHistoricalNotes({
    notes,
    auditor_email,
    employee_number,
  });

  const { data: run, error: runError } = await supabaseAdmin
    .from("audit_runs")
    .insert({
      hotel_id,
      area_id,
      audit_template_id: template_id,
      executed_by,
      status: "submitted",
      executed_at,
      score: score ?? 0,
      notes: historicalNotes,
      audit_channel: "internal",
      origin_type: "historical_import",
    })
    .select()
    .single();

  if (runError || !run?.id) {
    console.error("RUN ERROR FULL:", JSON.stringify(runError, null, 2));
    throw new Error(runError?.message ?? "No se pudo crear audit_run histórico.");
  }

  const answersToInsert = questions.map((question) => ({
    audit_run_id: String(run.id),
    question_id: question.id,
    answer: answers[question.code] ?? null,
    result: answers[question.code] ?? null,
    comment: null,
    photo_path: null,
  }));

  const { error: answersError } = await supabaseAdmin
    .from("audit_answers")
    .insert(answersToInsert);

  if (answersError) {
    console.error("ANSWERS ERROR FULL:", JSON.stringify(answersError, null, 2));
    await supabaseAdmin.from("audit_runs").delete().eq("id", run.id);
    throw new Error(answersError.message);
  }

  return run;
}
