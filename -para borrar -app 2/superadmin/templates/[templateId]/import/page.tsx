"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";
import { normalizeQuestionOrderForTemplate } from "@/lib/audits/normalizeQuestionOrder";

type ParsedRow = {
  standard: string;
  tag: string;
  classification: string;
};

type RequirementType = "never" | "if_fail" | "always";

function normHeader(s: string) {
  return (s ?? "").trim().toUpperCase();
}
function normKey(s: string) {
  return (s ?? "")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
function cleanCell(s: string) {
  return (s ?? "").replace(/\u00A0/g, " ").trim();
}
function splitRowSmart(line: string) {
  const raw = (line ?? "").replace(/\u00A0/g, " ").trimEnd();
  if (!raw) return [];
  if (raw.includes("\t")) return raw.split("\t").map((c) => cleanCell(c));
  return raw.split(/\s{2,}/g).map((c) => cleanCell(c));
}
function normalizeStdAndTag(standardRaw: string, tagRaw: string) {
  let standard = cleanCell(standardRaw ?? "");
  let tag = cleanCell(tagRaw ?? "");

  const m = standard.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (m) {
    const bracketTag = cleanCell(m[1] ?? "");
    const rest = cleanCell(m[2] ?? "");

    if (!tag || normKey(tag) === normKey(bracketTag)) {
      tag = bracketTag;
      standard = rest;
    } else {
      standard = rest;
    }
  }

  return { standard, tag };
}

export default function GlobalTemplateImportPage() {
  const router = useRouter();
  const params = useParams<{ templateId: string }>();
  const templateId = params?.templateId;

  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const [diagSectionsCount, setDiagSectionsCount] = useState<number>(0);
  const [diagMappedOk, setDiagMappedOk] = useState<number>(0);

  // Validar template existe + es global + superadmin
  useEffect(() => {
    if (!templateId) return;

    (async () => {
      setLoading(true);
      setError(null);

      const p = await requireRoleOrRedirect(router, ["superadmin"], "/dashboard");
      if (!p) return;

      const { data, error: tErr } = await supabase
        .from("audit_templates")
        .select("id,scope")
        .eq("id", templateId)
        .single();

      if (tErr || !data) {
        setError(tErr?.message ?? "No se encontró la plantilla.");
        setLoading(false);
        return;
      }

      if ((data as any)?.scope !== "global") {
        setError("Esta plantilla no es GLOBAL. Solo se puede importar en plantillas scope='global'.");
        setLoading(false);
        return;
      }

      setLoading(false);
    })();
  }, [templateId, router]);

  const parsed = useMemo(() => {
    const text = raw.trim();
    if (!text) {
      return { rows: [] as ParsedRow[], sectionsCount: 0, questionsCount: 0, parseError: null as string | null };
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return {
        rows: [] as ParsedRow[],
        sectionsCount: 0,
        questionsCount: 0,
        parseError: "Pega la tabla con cabeceras y al menos 1 fila.",
      };
    }

    const header = splitRowSmart(lines[0]).map(normHeader);
    const idxStandard = header.findIndex((h) => h === "STANDARD");
    const idxTag = header.findIndex((h) => h === "TAG");
    const idxClass = header.findIndex((h) => h === "CLASSIFICATION");

    if (idxStandard === -1 || idxTag === -1 || idxClass === -1) {
      return {
        rows: [] as ParsedRow[],
        sectionsCount: 0,
        questionsCount: 0,
        parseError: "Debe incluir encabezados exactos: STANDARD, TAG, CLASSIFICATION",
      };
    }

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitRowSmart(lines[i]);
      if (!cols.length) continue;

      const standardRaw = cols[idxStandard] ?? "";
      const tagRaw = cols[idxTag] ?? "";
      const classificationRaw = cols[idxClass] ?? "";

      const { standard, tag } = normalizeStdAndTag(standardRaw, tagRaw);
      const classification = cleanCell(classificationRaw ?? "");

      if (!standard || !classification) continue;
      rows.push({ standard, tag, classification });
    }

    const uniqSections = new Set(rows.map((r) => normKey(r.classification)));
    return { rows, sectionsCount: uniqSections.size, questionsCount: rows.length, parseError: null as string | null };
  }, [raw]);

  async function importNow() {
    if (!templateId) return;

    setError(null);
    setInfo(null);
    setDiagSectionsCount(0);
    setDiagMappedOk(0);

    if (parsed.parseError) return setError(parsed.parseError);
    if (parsed.rows.length === 0) return setError("No hay filas válidas para importar.");

    setImporting(true);
    setDone(false);

    try {
      // 1) Secciones existentes
      const { data: existingSections, error: sErr } = await supabase
        .from("audit_sections")
        .select("id,name")
        .eq("audit_template_id", templateId);

      if (sErr) throw sErr;

      const mapByKey = new Map<string, { id: string; name: string }>();
      (existingSections ?? []).forEach((s: any) => {
        const name = cleanCell(s.name ?? "");
        mapByKey.set(normKey(name), { id: s.id, name });
      });

      // 2) Crear secciones nuevas (orden first-seen)
      const orderedSections: string[] = [];
      const seen = new Set<string>();

      for (const r of parsed.rows) {
        const name = cleanCell(r.classification);
        const key = normKey(name);
        if (!seen.has(key)) {
          seen.add(key);
          orderedSections.push(name);
        }
      }

      for (const secName of orderedSections) {
        const key = normKey(secName);
        if (mapByKey.has(key)) continue;

        const { data: insSec, error: insSecErr } = await supabase
          .from("audit_sections")
          .insert({ audit_template_id: templateId, name: secName, active: true })
          .select("id,name")
          .single();

        if (insSecErr || !insSec) throw insSecErr ?? new Error("No se pudo crear sección (RLS o validación).");
        mapByKey.set(normKey(insSec.name), { id: insSec.id, name: insSec.name });
      }

      setDiagSectionsCount(mapByKey.size);

      // 3) Validación dura
      const missing: Array<{ i: number; classification: string; key: string }> = [];
      let okCount = 0;

      parsed.rows.forEach((r, idx) => {
        const cls = cleanCell(r.classification);
        const key = normKey(cls);
        const sec = mapByKey.get(key);
        if (!sec?.id) missing.push({ i: idx + 1, classification: cls, key });
        else okCount += 1;
      });

      setDiagMappedOk(okCount);

      if (missing.length) {
        const first = missing.slice(0, 10);
        throw new Error(
          `No puedo importar porque ${missing.length} filas NO encuentran su sección.\n` +
            `Ejemplos:\n` +
            first.map((m) => `- Fila ${m.i}: CLASSIFICATION="${m.classification}" (key="${m.key}")`).join("\n") +
            `\n\nSolución: revisa CLASSIFICATION (espacios raros / nombre distinto).`
        );
      }

      // 4) Insertar preguntas con RequirementType (tu esquema real)
      const orderCounters = new Map<string, number>();

      const inserts = parsed.rows.map((r) => {
        const cls = cleanCell(r.classification);
        const sec = mapByKey.get(normKey(cls))!;

        const current = orderCounters.get(sec.id) ?? 0;
        const nextOrder = current + 1;
        orderCounters.set(sec.id, nextOrder);

        return {
          audit_section_id: sec.id,
          text: r.standard,
          tag: r.tag ? r.tag : null,
          order: nextOrder,
          active: true,
          comment_requirement: "never" as RequirementType,
          photo_requirement: "never" as RequirementType,
          signature_requirement: "never" as RequirementType,
        };
      });

      const { error: insQErr } = await supabase.from("audit_questions").insert(inserts);
      if (insQErr) throw insQErr;

      await normalizeQuestionOrderForTemplate(templateId);

      setInfo(`Importación completada ✅  ${parsed.sectionsCount} secciones · ${parsed.questionsCount} preguntas.`);
      setDone(true);
      setRaw("");
    } catch (e: any) {
      setError(e?.message ?? "Error importando.");
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 24, paddingTop: 80 }}>
        <HotelHeader />
        Cargando…
      </main>
    );
  }

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <HotelHeader />

      <button
        onClick={() => router.push(`/superadmin/templates/${templateId}`)}
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.2)",
          background: "#fff",
          color: "#000",
          fontWeight: 900,
          cursor: "pointer",
          height: 42,
        }}
      >
        ← Atrás
      </button>

      <h1 style={{ fontSize: 44, marginBottom: 6 }}>Importar Excel (Global)</h1>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>
        Debe incluir encabezados: <b>STANDARD</b>, <b>TAG</b>, <b>CLASSIFICATION</b>.
      </div>

      {error ? (
        <div style={{ color: "crimson", fontWeight: 900, marginBottom: 12, whiteSpace: "pre-wrap" }}>{error}</div>
      ) : null}

      {info ? <div style={{ color: "green", fontWeight: 900, marginBottom: 12 }}>{info}</div> : null}

      <div
        style={{
          borderRadius: 18,
          border: "1px solid rgba(0,0,0,0.10)",
          background: "rgba(255,255,255,0.85)",
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 950, marginBottom: 8 }}>Pega tu tabla desde Excel/Sheets</div>

        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setError(null);
            setInfo(null);
            setDone(false);
          }}
          placeholder={"STANDARD\tTAG\tCLASSIFICATION\nTelephone conversation is calm and clear\tService\tGuest Comfort & Convenience"}
          style={{
            width: "100%",
            minHeight: 220,
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.15)",
            padding: 12,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <button
            onClick={importNow}
            disabled={importing || done}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.2)",
              background: "#000",
              color: "#fff",
              fontWeight: 950,
              cursor: importing || done ? "not-allowed" : "pointer",
              opacity: importing || done ? 0.6 : 1,
              height: 42,
            }}
          >
            {done ? "Importado ✅" : importing ? "Importando…" : "Importar ahora"}
          </button>

          <div style={{ fontWeight: 900, opacity: 0.85 }}>
            Detectadas: {parsed.sectionsCount} secciones · {parsed.questionsCount} preguntas
          </div>
        </div>

        {(diagSectionsCount || diagMappedOk) ? (
          <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
            Diagnóstico: secciones en DB (map): <b>{diagSectionsCount}</b> · filas con sección resuelta: <b>{diagMappedOk}</b>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 16, opacity: 0.85 }}>
        <div style={{ fontWeight: 950, marginBottom: 8 }}>Vista previa</div>
        <div style={{ borderRadius: 14, border: "1px solid rgba(0,0,0,0.10)", background: "#fff", padding: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontWeight: 950 }}>
                <th style={{ padding: 8 }}>CLASSIFICATION</th>
                <th style={{ padding: 8 }}>TAG</th>
                <th style={{ padding: 8 }}>STANDARD</th>
              </tr>
            </thead>
            <tbody>
              {parsed.rows.slice(0, 12).map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  <td style={{ padding: 8, fontWeight: 900 }}>{r.classification}</td>
                  <td style={{ padding: 8 }}>{r.tag || "—"}</td>
                  <td style={{ padding: 8 }}>{r.standard}</td>
                </tr>
              ))}
              {parsed.rows.length > 12 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 8, opacity: 0.7 }}>
                    …y {parsed.rows.length - 12} más
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}