// FILE: app/superadmin/templates/[templateId]/import/page.tsx
"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import HotelHeader from "@/app/components/HotelHeader";
import { fetchJsonOrThrow } from "@/lib/superadmin/clientApi";

type ParsedRow = {
  order: number | null;
  standard: string;
  standardEn: string;
  tag: string;
  classification: string;
  certificationIds: string[];
};

type CertificationStandardRow = { id: string; name: string };

function normHeader(s: string) {
  return (s ?? "").trim().toUpperCase();
}
function normKey(s: string) {
  return (s ?? "")
    .replace(/ /g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
function cleanCell(s: string) {
  return (s ?? "").replace(/ /g, " ").trim();
}
function splitRowSmart(line: string) {
  const raw = (line ?? "").replace(/ /g, " ").trimEnd();
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
function isMarkTruthy(s: string) {
  const v = cleanCell(s).toUpperCase();
  if (!v) return false;
  return !["NO", "N", "0", "FALSE"].includes(v);
}

const RESERVED_HEADERS = new Set(["STANDARD", "STANDARD_EN", "STANDARD (EN)", "TAG", "CLASSIFICATION", "NUM", "#", "ORDEN", "ORDER"]);

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

  const [certifications, setCertifications] = useState<CertificationStandardRow[]>([]);

  const [rows, setRows] = useState<ParsedRow[]>([]);

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

      try {
        const { data: packLinks, error: packLinksErr } = await supabase
          .from("global_audit_pack_templates")
          .select("pack_id")
          .eq("audit_template_id", templateId);
        if (packLinksErr) throw packLinksErr;

        const packIds = Array.from(new Set((packLinks ?? []).map((l) => l.pack_id)));

        let certData: CertificationStandardRow[] = [];
        if (packIds.length) {
          const { data: packCertLinks, error: packCertErr } = await supabase
            .from("global_audit_pack_certifications")
            .select("certification_standard_id")
            .in("pack_id", packIds);
          if (packCertErr) throw packCertErr;

          const certIds = Array.from(new Set((packCertLinks ?? []).map((l) => l.certification_standard_id)));

          if (certIds.length) {
            const { data: certRows, error: certErr } = await supabase
              .from("certification_standards")
              .select("id,name")
              .in("id", certIds)
              .eq("active", true)
              .order("name", { ascending: true });
            if (certErr) throw certErr;
            certData = (certRows ?? []) as CertificationStandardRow[];
          }
        }
        setCertifications(certData);
      } catch {
        setCertifications([]);
      }

      setLoading(false);
    })();
  }, [templateId]);

  const parsed = useMemo(() => {
    const text = raw.trim();
    if (!text) return { rows: [] as ParsedRow[], parseError: null as string | null };

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return { rows: [], parseError: "Pega la tabla con cabeceras y al menos 1 fila." };
    }

    const header = splitRowSmart(lines[0]).map(normHeader);
    const idxStandard = header.findIndex((h) => h === "STANDARD");
    const idxStandardEn = header.findIndex((h) => h === "STANDARD_EN" || h === "STANDARD (EN)");
    const idxTag = header.findIndex((h) => h === "TAG");
    const idxClass = header.findIndex((h) => h === "CLASSIFICATION");
    const idxOrder = header.findIndex((h) => h === "NUM" || h === "#" || h === "ORDEN" || h === "ORDER");

    if (idxStandard === -1 || idxTag === -1 || idxClass === -1) {
      return { rows: [], parseError: "Debe incluir encabezados exactos: STANDARD, TAG, CLASSIFICATION (STANDARD_EN, NUM/# son opcionales)" };
    }

    const certColumns: { index: number; certificationId: string }[] = [];
    header.forEach((h, idx) => {
      if (RESERVED_HEADERS.has(h)) return;
      const cert = certifications.find((c) => normKey(c.name) === normKey(h));
      if (cert) certColumns.push({ index: idx, certificationId: cert.id });
    });

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitRowSmart(lines[i]);
      if (!cols.length) continue;

      const standardRaw = cols[idxStandard] ?? "";
      const standardEnRaw = idxStandardEn === -1 ? "" : cols[idxStandardEn] ?? "";
      const tagRaw = cols[idxTag] ?? "";
      const classificationRaw = cols[idxClass] ?? "";
      const orderRaw = idxOrder === -1 ? "" : cols[idxOrder] ?? "";

      const { standard, tag } = normalizeStdAndTag(standardRaw, tagRaw);
      const standardEn = cleanCell(standardEnRaw ?? "");
      const classification = cleanCell(classificationRaw ?? "");
      const orderClean = cleanCell(orderRaw ?? "");
      const orderNum = orderClean === "" ? null : Number(orderClean);
      const order = orderNum !== null && Number.isFinite(orderNum) ? orderNum : null;

      const certificationIds = certColumns
        .filter(({ index }) => isMarkTruthy(cols[index] ?? ""))
        .map(({ certificationId }) => certificationId);

      if (!standard || !classification) continue;
      rows.push({ order, standard, standardEn, tag, classification, certificationIds });
    }

    return { rows, parseError: null };
  }, [raw, certifications]);

  useEffect(() => {
    setRows(parsed.rows);
  }, [raw]);

  const summary = useMemo(() => {
    const uniqSections = new Set(rows.map((r) => normKey(r.classification)));
    return { sectionsCount: uniqSections.size, questionsCount: rows.length };
  }, [rows]);

  function updateRow(index: number, patch: Partial<ParsedRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function toggleCertification(index: number, certificationId: string, checked: boolean) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const set = new Set(r.certificationIds);
        if (checked) set.add(certificationId);
        else set.delete(certificationId);
        return { ...r, certificationIds: Array.from(set) };
      })
    );
  }

  async function importNow() {
    if (!templateId) return;

    setError(null);
    setInfo(null);
    setDiagSectionsCount(0);
    setDiagMappedOk(0);

    if (parsed.parseError) return setError(parsed.parseError);
    if (rows.length === 0) return setError("No hay filas válidas para importar.");

    setImporting(true);
    setDone(false);

    try {
      const result = await fetchJsonOrThrow<{ sections_count: number; imported_questions: number }>(
        `/api/superadmin/templates/${templateId}/import`,
        {
          method: "POST",
          body: JSON.stringify({ rows }),
        }
      );

      setDiagSectionsCount(result.sections_count);
      setDiagMappedOk(result.imported_questions);

      setInfo(`Importación completada ✅  ${summary.sectionsCount} secciones · ${summary.questionsCount} preguntas.`);
      setDone(true);
      setRaw("");
      setRows([]);
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

  const cellInput: CSSProperties = {
    width: "100%",
    border: "1px solid rgba(0,0,0,0.15)",
    borderRadius: 8,
    padding: "6px 8px",
    fontSize: 13,
    fontFamily: "inherit",
  };

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <HotelHeader />

      <button onClick={() => router.push(`/superadmin/templates/${templateId}`)} style={btnWhite}>
        ← Atrás
      </button>

      <h1 style={{ fontSize: 44, marginBottom: 6 }}>Importar catálogo global</h1>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>
        Esta pantalla es solo para importar preguntas/estándares del catálogo global. No se usa para auditorías históricas.
      </div>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>
        Debe incluir encabezados: <b>STANDARD</b>, <b>TAG</b>, <b>CLASSIFICATION</b>. Opcionales:{" "}
        <b>STANDARD_EN</b> (el auditor lo verá en vez de STANDARD cuando tenga el idioma de interfaz en
        inglés), <b>NUM</b> o <b>#</b> (respeta el número de orden que definas), y una columna por cada
        certificado (marca con <b>X</b> las filas que apliquen)
        {certifications.length ? (
          <>
            : {certifications.map((c) => (
              <b key={c.id} style={{ marginRight: 6 }}>
                {c.name}
              </b>
            ))}
          </>
        ) : (
          " (este pack no tiene certificados configurados todavía)."
        )}
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
          placeholder={"NUM\tSTANDARD\tSTANDARD_EN\tTAG\tCLASSIFICATION\tPARADISUS\tLHW\tFORBES\n1\tLa conversación telefónica es tranquila y clara\tTelephone conversation is calm and clear\tService\tGuest Comfort & Convenience\tX\tX\tX"}
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
            Detectadas: {summary.sectionsCount} secciones · {summary.questionsCount} preguntas
          </div>
        </div>

        {(diagSectionsCount || diagMappedOk) ? (
          <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
            Diagnóstico: secciones en DB (map): <b>{diagSectionsCount}</b> · filas con sección resuelta: <b>{diagMappedOk}</b>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 16, opacity: 0.85 }}>
        <div style={{ fontWeight: 950, marginBottom: 8 }}>Vista previa (editable — revisa antes de importar)</div>
        <div style={{ borderRadius: 14, border: "1px solid rgba(0,0,0,0.10)", background: "#fff", padding: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontWeight: 950 }}>
                <th style={{ padding: 8, width: 60 }}>#</th>
                <th style={{ padding: 8, minWidth: 160 }}>CLASSIFICATION</th>
                <th style={{ padding: 8, minWidth: 120 }}>TAG</th>
                <th style={{ padding: 8, minWidth: 280 }}>STANDARD</th>
                <th style={{ padding: 8, minWidth: 280 }}>STANDARD_EN</th>
                {certifications.map((c) => (
                  <th key={c.id} style={{ padding: 8, textAlign: "center" }}>
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  <td style={{ padding: 6 }}>
                    <input
                      type="number"
                      value={r.order ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateRow(i, { order: v === "" ? null : Number(v) });
                      }}
                      style={{ ...cellInput, width: 60 }}
                    />
                  </td>
                  <td style={{ padding: 6 }}>
                    <input
                      value={r.classification}
                      onChange={(e) => updateRow(i, { classification: e.target.value })}
                      style={cellInput}
                    />
                  </td>
                  <td style={{ padding: 6 }}>
                    <input value={r.tag} onChange={(e) => updateRow(i, { tag: e.target.value })} style={cellInput} />
                  </td>
                  <td style={{ padding: 6 }}>
                    <input
                      value={r.standard}
                      onChange={(e) => updateRow(i, { standard: e.target.value })}
                      style={cellInput}
                    />
                  </td>
                  <td style={{ padding: 6 }}>
                    <input
                      value={r.standardEn}
                      onChange={(e) => updateRow(i, { standardEn: e.target.value })}
                      style={cellInput}
                    />
                  </td>
                  {certifications.map((c) => (
                    <td key={c.id} style={{ padding: 6, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={r.certificationIds.includes(c.id)}
                        onChange={(e) => toggleCertification(i, c.id, e.target.checked)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5 + certifications.length} style={{ padding: 8, opacity: 0.7 }}>
                    Pega una tabla arriba para ver la vista previa.
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
