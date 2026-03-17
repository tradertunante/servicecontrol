// FILE: app/superadmin/templates/[templateId]/import/page.tsx
"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import HotelHeader from "@/app/components/HotelHeader";
import { fetchJsonOrThrow } from "@/lib/superadmin/clientApi";

type ParsedRow = { standard: string; tag: string; classification: string };

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
  const params = useParams();
  const templateId = (params as any)?.templateId as string | undefined;

  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const [diagSectionsCount, setDiagSectionsCount] = useState<number>(0);
  const [diagMappedOk, setDiagMappedOk] = useState<number>(0);

  useEffect(() => {
    if (!templateId) {
      setLoading(false);
      setError("Falta templateId en la URL.");
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);

      const { data, error: tErr } = await supabase.from("audit_templates").select("id,scope").eq("id", templateId).single();

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
  }, [templateId]);

  const parsed = useMemo(() => {
    const text = raw.trim();
    if (!text) return { rows: [] as ParsedRow[], sectionsCount: 0, questionsCount: 0, parseError: null as string | null };

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return { rows: [], sectionsCount: 0, questionsCount: 0, parseError: "Pega la tabla con cabeceras y al menos 1 fila." };
    }

    const header = splitRowSmart(lines[0]).map(normHeader);
    const idxStandard = header.findIndex((h) => h === "STANDARD");
    const idxTag = header.findIndex((h) => h === "TAG");
    const idxClass = header.findIndex((h) => h === "CLASSIFICATION");

    if (idxStandard === -1 || idxTag === -1 || idxClass === -1) {
      return { rows: [], sectionsCount: 0, questionsCount: 0, parseError: "Debe incluir encabezados exactos: STANDARD, TAG, CLASSIFICATION" };
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
    return { rows, sectionsCount: uniqSections.size, questionsCount: rows.length, parseError: null };
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
      const result = await fetchJsonOrThrow<{ sections_count: number; imported_questions: number }>(
        `/api/superadmin/templates/${templateId}/import`,
        {
          method: "POST",
          body: JSON.stringify({ rows: parsed.rows }),
        }
      );

      setDiagSectionsCount(result.sections_count);
      setDiagMappedOk(result.imported_questions);

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

  const btnWhite: CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    height: 42,
  };

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <HotelHeader />

      <button onClick={() => router.push(`/superadmin/templates/${templateId}`)} style={btnWhite}>
        ← Atrás
      </button>

      <h1 style={{ fontSize: 44, marginBottom: 6 }}>Importar Excel (Global)</h1>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>
        Debe incluir encabezados: <b>STANDARD</b>, <b>TAG</b>, <b>CLASSIFICATION</b>.
      </div>

      {error ? <div style={{ color: "crimson", fontWeight: 900, marginBottom: 12, whiteSpace: "pre-wrap" }}>{error}</div> : null}
      {info ? <div style={{ color: "green", fontWeight: 900, marginBottom: 12 }}>{info}</div> : null}

      <div style={{ borderRadius: 18, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(255,255,255,0.85)", padding: 16 }}>
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
