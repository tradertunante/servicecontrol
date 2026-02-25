"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BackButton from "@/app/components/BackButton";

type Role = "admin" | "manager" | "auditor" | "superadmin";

type Profile = {
  id: string;
  hotel_id: string | null;
  role: Role;
  active: boolean | null;
};

type AreaRow = { id: string; name: string; type: string | null };

const HOTEL_KEY = "sc_hotel_id";

function canManageTeam(role: Role) {
  return role === "admin" || role === "manager" || role === "superadmin";
}

function norm(s: string) {
  return (s ?? "").trim().toLowerCase();
}

function detectDelimiter(headerLine: string) {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const c = headerLine.split(d).length;
    if (c > bestCount) {
      bestCount = c;
      best = d;
    }
  }
  return best;
}

// CSV parser simple (soporta comillas y separadores comunes)
function parseCSV(text: string) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [] as string[], rows: [] as string[][] };

  const delimiter = detectDelimiter(lines[0]);

  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        // doble comilla dentro de comillas => "
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && ch === delimiter) {
        out.push(cur.trim());
        cur = "";
        continue;
      }

      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const headers = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, "").trim());
  const rows = lines.slice(1).map(parseLine).map((r) => r.map((c) => c.replace(/^"|"$/g, "").trim()));
  return { headers, rows };
}

type PreviewRow = {
  rowIndex: number;
  full_name: string;
  position: string;
  employee_number?: string;
  areas: string[];
  areaIds: string[];
  ok: boolean;
  error?: string;
};

export default function TeamImportPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hotelId, setHotelId] = useState<string | null>(null);
  const [areas, setAreas] = useState<AreaRow[]>([]);

  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);

  function getActiveHotelId(p: Profile): string | null {
    if (p.role === "superadmin") {
      const v = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;
      return v || null;
    }
    return p.hotel_id ?? null;
  }

  const areaIndex = useMemo(() => {
    // Mapa por (name) y por (name·type)
    const byName = new Map<string, AreaRow[]>();
    const byKey = new Map<string, AreaRow>();

    for (const a of areas) {
      const n = norm(a.name);
      byName.set(n, [...(byName.get(n) ?? []), a]);

      const key = norm(`${a.name} · ${a.type ?? ""}`.replace(/\s+/g, " ").trim());
      byKey.set(key, a);
    }

    return { byName, byKey };
  }, [areas]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          router.push("/login");
          return;
        }

        const { data: pData, error: pErr } = await supabase
          .from("profiles")
          .select("id,hotel_id,role,active")
          .eq("id", userData.user.id)
          .single();

        if (pErr || !pData || pData.active === false) {
          router.push("/login");
          return;
        }

        const p = pData as Profile;
        if (!canManageTeam(p.role)) {
          router.push("/dashboard");
          return;
        }

        const hid = getActiveHotelId(p);
        if (!hid) {
          setLoading(false);
          setError("Selecciona un hotel primero.");
          return;
        }

        const { data: aData, error: aErr } = await supabase
          .from("areas")
          .select("id,name,type")
          .eq("hotel_id", hid)
          .order("name", { ascending: true });

        if (aErr) throw aErr;

        if (!alive) return;
        setHotelId(hid);
        setAreas((aData ?? []) as any);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setLoading(false);
        setError(e?.message ?? "Error cargando importador.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  function resolveAreaId(cell: string): { id: string | null; err?: string } {
    const raw = (cell ?? "").trim();
    if (!raw) return { id: null };

    // Si viene como "NAME · TYPE"
    if (raw.includes("·")) {
      const key = norm(raw.replace(/\s+/g, " ").trim());
      const found = areaIndex.byKey.get(key);
      if (!found) return { id: null, err: `Área no encontrada: "${raw}"` };
      return { id: found.id };
    }

    // Match por name (si único)
    const list = areaIndex.byName.get(norm(raw)) ?? [];
    if (list.length === 0) return { id: null, err: `Área no encontrada: "${raw}"` };
    if (list.length > 1) {
      return {
        id: null,
        err: `Área ambigua "${raw}". Usa "Nombre · Tipo" (por ejemplo: "${list[0].name} · ${list[0].type ?? "—"}").`,
      };
    }
    return { id: list[0].id };
  }

  async function onPickFile(file: File) {
    setError(null);
    setPreview([]);
    setFileName(file.name);

    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    const h = headers.map((x) => x.trim());
    const idxFull = h.findIndex((x) => norm(x) === "full_name");
    const idxPos = h.findIndex((x) => norm(x) === "position");
    const idxEmp = h.findIndex((x) => norm(x) === "employee_number" || norm(x) === "employee_number (optional)");

    const areaCols = h
      .map((name, i) => ({ name, i }))
      .filter((x) => norm(x.name).startsWith("area_"));

    if (idxFull === -1 || idxPos === -1) {
      setError('CSV inválido. Debe tener columnas: "full_name" y "position". (Y opcional "employee_number", "area_1", "area_2"...).');
      return;
    }

    const out: PreviewRow[] = [];

    rows.forEach((r, i) => {
      const rowIndex = i + 2; // contando header como línea 1
      const full_name = (r[idxFull] ?? "").trim();
      const position = (r[idxPos] ?? "").trim();
      const employee_number = idxEmp >= 0 ? (r[idxEmp] ?? "").trim() : "";

      const areaNames: string[] = [];
      for (const c of areaCols) {
        const v = (r[c.i] ?? "").trim();
        if (v) areaNames.push(v);
      }

      const areaIds: string[] = [];
      const errs: string[] = [];

      if (!full_name) errs.push("Falta full_name");
      if (!position) errs.push("Falta position");

      for (const nm of areaNames) {
        const res = resolveAreaId(nm);
        if (!res.id) {
          if (res.err) errs.push(res.err);
        } else {
          areaIds.push(res.id);
        }
      }

      // dedupe
      const uniqIds = Array.from(new Set(areaIds));

      out.push({
        rowIndex,
        full_name,
        position,
        employee_number: employee_number || undefined,
        areas: areaNames,
        areaIds: uniqIds,
        ok: errs.length === 0,
        error: errs.length ? errs.join(" · ") : undefined,
      });
    });

    setPreview(out);
  }

  async function importAll() {
    if (!hotelId) return;
    setError(null);

    const okRows = preview.filter((r) => r.ok);
    if (!okRows.length) {
      setError("No hay filas válidas para importar.");
      return;
    }

    setSaving(true);
    try {
      // 1) Insertar team_members
      // NOTA: employee_number requiere columna en DB; si no existe, quita employee_number del insert.
      const memberPayload = okRows.map((r) => ({
        hotel_id: hotelId,
        full_name: r.full_name,
        position: r.position || null,
        employee_number: r.employee_number ?? null,
        active: true,
      }));

      const { data: inserted, error: insErr } = await supabase
        .from("team_members")
        .insert(memberPayload)
        .select("id,full_name");

      if (insErr) throw insErr;

      const insertedList = (inserted ?? []) as any[];
      if (!insertedList.length) throw new Error("No se insertó ningún colaborador.");

      // 2) Crear links team_member_areas
      // Emparejamos por orden (Supabase suele devolver en el mismo orden del insert)
      const linkPayload: { team_member_id: string; area_id: string }[] = [];

      for (let i = 0; i < insertedList.length; i++) {
        const memberId = insertedList[i].id as string;
        const row = okRows[i];
        for (const areaId of row.areaIds) linkPayload.push({ team_member_id: memberId, area_id: areaId });
      }

      if (linkPayload.length) {
        const { error: linkErr } = await supabase.from("team_member_areas").upsert(linkPayload, {
          onConflict: "team_member_id,area_id",
        });
        if (linkErr) throw linkErr;
      }

      // listo
      router.push("/team");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo importar.");
    } finally {
      setSaving(false);
    }
  }

  const stats = useMemo(() => {
    const total = preview.length;
    const ok = preview.filter((r) => r.ok).length;
    const bad = total - ok;
    return { total, ok, bad };
  }, [preview]);

  if (loading) {
    return (
      <main className="w-full min-h-screen bg-gray-50 overflow-x-hidden">
        <div className="w-full px-4 py-4">
          <p className="text-sm text-gray-600">Cargando…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="w-full px-4 pt-4 pb-24">
        <div className="mb-3">
          <BackButton fallback="/team" />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Importar colaboradores</h1>
            <p className="mt-1 text-sm font-semibold text-gray-600">
              Sube un CSV con columnas: <span className="font-mono">full_name</span>, <span className="font-mono">position</span>,{" "}
              <span className="font-mono">employee_number</span> (opcional), y <span className="font-mono">area_1</span>,{" "}
              <span className="font-mono">area_2</span>...
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {/* 1) archivo */}
        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold mb-2">1) Selecciona CSV</div>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickFile(f);
            }}
            className="block w-full text-sm"
          />

          {fileName ? <div className="mt-2 text-xs font-semibold text-gray-500">Archivo: {fileName}</div> : null}
        </section>

        {/* 2) preview */}
        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold">2) Previsualiza</div>
              <div className="mt-1 text-sm font-semibold text-gray-600">
                Total: {stats.total} · OK: {stats.ok} · Con errores: {stats.bad}
              </div>
            </div>

            <button
              onClick={importAll}
              disabled={saving || stats.ok === 0}
              className="rounded-2xl bg-black px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {saving ? "Importando…" : `Importar ${stats.ok}`}
            </button>
          </div>

          {preview.length ? (
            <div className="mt-4 overflow-auto rounded-2xl border">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="p-3 font-extrabold">Fila</th>
                    <th className="p-3 font-extrabold">Nombre</th>
                    <th className="p-3 font-extrabold">Posición</th>
                    <th className="p-3 font-extrabold">Nº colaborador</th>
                    <th className="p-3 font-extrabold">Áreas</th>
                    <th className="p-3 font-extrabold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.rowIndex} className="border-t">
                      <td className="p-3 font-semibold text-gray-600">{r.rowIndex}</td>
                      <td className="p-3 font-extrabold">{r.full_name || "—"}</td>
                      <td className="p-3 font-semibold">{r.position || "—"}</td>
                      <td className="p-3 font-semibold">{r.employee_number ?? "—"}</td>
                      <td className="p-3 font-semibold text-gray-700">{r.areas.join(", ") || "—"}</td>
                      <td className="p-3">
                        {r.ok ? (
                          <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-extrabold text-green-700">
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-extrabold text-red-700">
                            {r.error ?? "Error"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-3 text-sm font-semibold text-gray-600">Sube un CSV para ver la previsualización.</div>
          )}
        </section>

        {/* ejemplo */}
        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold mb-2">Formato de ejemplo (CSV)</div>

          <pre className="rounded-2xl border bg-gray-50 p-4 text-xs overflow-auto">
{`full_name,position,employee_number,area_1,area_2,area_3
"María López","Camarista","EMP-100","Housekeeping · ROOMS","",""
"Juan Pérez","Mesero","","CAPELLA · A&B","SAL · A&B","CIELO · A&B"
`}
          </pre>

          <div className="mt-2 text-xs font-semibold text-gray-500">
            Nota: el nombre del área debe existir en tu tabla <span className="font-mono">areas</span> para ese hotel. Si hay duplicados por nombre, usa “Nombre · Tipo”.
          </div>
        </section>
      </div>
    </main>
  );
}