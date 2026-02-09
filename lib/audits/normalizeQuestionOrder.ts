import { supabase } from "@/lib/supabaseClient";

type QRow = {
  id: string;
  audit_section_id: string;
  order: number | null;
  created_at: string | null;
};

function safeTime(iso: string | null) {
  return iso ? new Date(iso).getTime() : 0;
}

export async function normalizeQuestionOrderForTemplate(templateId: string) {
  // 1) Traer secciones del template
  const { data: secs, error: sErr } = await supabase
    .from("audit_sections")
    .select("id")
    .eq("audit_template_id", templateId);

  if (sErr) throw sErr;

  const sectionIds = (secs ?? []).map((s: any) => s.id).filter(Boolean);
  if (sectionIds.length === 0) return { updated: 0 };

  // 2) Traer preguntas de esas secciones (incluye inactivas también, para que no se rompa el orden)
  const { data: qs, error: qErr } = await supabase
    .from("audit_questions")
    .select("id,audit_section_id,order,created_at")
    .in("audit_section_id", sectionIds)
    .order("audit_section_id", { ascending: true })
    .order("order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (qErr) throw qErr;

  const rows = (qs ?? []) as QRow[];
  if (rows.length === 0) return { updated: 0 };

  // 3) Agrupar por sección
  const bySec: Record<string, QRow[]> = {};
  for (const q of rows) {
    if (!bySec[q.audit_section_id]) bySec[q.audit_section_id] = [];
    bySec[q.audit_section_id].push(q);
  }

  // 4) Crear updates: order = 1..N por sección, siguiendo el orden actual estable
  const updates: Array<{ id: string; order: number }> = [];

  for (const secId of Object.keys(bySec)) {
    const list = bySec[secId];

    // Orden estable en caso de datos raros
    list.sort((a, b) => {
      const ao = a.order ?? 999999;
      const bo = b.order ?? 999999;
      if (ao !== bo) return ao - bo;

      const at = safeTime(a.created_at);
      const bt = safeTime(b.created_at);
      if (at !== bt) return at - bt;

      return a.id.localeCompare(b.id);
    });

    let i = 1;
    for (const q of list) {
      if (q.order !== i) updates.push({ id: q.id, order: i });
      i++;
    }
  }

  if (updates.length === 0) return { updated: 0 };

  // 5) Guardar en BD (upsert por id)
  // Nota: esto no crea filas nuevas porque los ids ya existen; solo actualiza order.
  const { error: upErr } = await supabase
    .from("audit_questions")
    .upsert(updates, { onConflict: "id" });

  if (upErr) throw upErr;

  return { updated: updates.length };
}
