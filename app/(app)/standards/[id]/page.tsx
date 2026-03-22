// app/standards/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/app/providers/ToastProvider";
import { supabase } from "@/lib/supabaseClient";
import HotelHeader from "@/app/components/HotelHeader";

type Library = {
  id: string;
  name: string;
  scope: string;
  category: string | null;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

type Section = {
  id: string;
  name: string;
  template_id: string;
};

type Question = {
  id: string;
  section_id: string;
  text: string;
};

export default function LibraryDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams();
  const libraryId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [library, setLibrary] = useState<Library | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null);
  const openTemplate = useMemo(
    () => templates.find((t) => t.id === openTemplateId) ?? null,
    [templates, openTemplateId]
  );

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: lib, error: lErr } = await supabase
          .from("standard_libraries")
          .select("id, name, scope, category")
          .eq("id", libraryId)
          .maybeSingle();

        if (lErr) throw lErr;
        if (!lib) throw new Error("Biblioteca no encontrada.");

        if (!alive) return;
        setLibrary(lib as Library);

        const { data: t, error: tErr } = await supabase
          .from("standard_templates")
          .select("id, name, description, active")
          .eq("library_id", libraryId)
          .eq("active", true)
          .order("name", { ascending: true });

        if (tErr) throw tErr;

        if (!alive) return;
        setTemplates((t ?? []) as Template[]);
        setLoading(false);
      } catch (e: unknown) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Error cargando la biblioteca.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [libraryId]);

  // Modal: cargar secciones + preguntas
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!openTemplateId) return;

      setModalLoading(true);
      setModalError(null);
      setSections([]);
      setQuestions([]);

      try {
        // ✅ Tu tabla real es standard_sections
        // ✅ y NO tiene description/position (por lo que NO las pedimos)
        const { data: s, error: sErr } = await supabase
          .from("standard_sections")
          .select("id, name, template_id")
          .eq("template_id", openTemplateId)
          .order("name", { ascending: true });

        if (sErr) throw sErr;

        const secArr = (s ?? []) as Section[];
        if (!alive) return;
        setSections(secArr);

        if (secArr.length === 0) {
          setModalLoading(false);
          return;
        }

        const sectionIds = secArr.map((x) => x.id);

        const { data: q, error: qErr } = await supabase
          .from("standard_questions")
          .select("id, section_id, text")
          .in("section_id", sectionIds)
          .order("id", { ascending: true });

        if (qErr) throw qErr;

        if (!alive) return;
        setQuestions((q ?? []) as Question[]);
        setModalLoading(false);
      } catch (e: unknown) {
        if (!alive) return;
        setModalError(e instanceof Error ? e.message : "Error cargando la plantilla.");
        setModalLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [openTemplateId]);

  if (loading) {
    return (
      <main className="p-6 pt-24">
        <HotelHeader />
        <div className="opacity-80">Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6 pt-24">
        <HotelHeader />
        <div className="text-[crimson] font-black">{error}</div>
      </main>
    );
  }

  return (
    <main className="p-6 pt-24">
      <HotelHeader />

      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <div className="text-[34px] font-black tracking-[-0.6px]">
            {library?.name ?? "Biblioteca"}
          </div>
          <div className="mt-1.5 opacity-75 text-[13px]">
            🌍 {library?.scope ?? "—"} · {library?.category ?? "—"}
          </div>
        </div>

        <div className="flex gap-2.5 items-center flex-wrap">
          <button
            className="px-[14px] py-2.5 rounded-xl border border-black/[0.18] bg-white text-black font-black cursor-pointer text-sm"
            onClick={() => router.push("/standards")}
          >
            ← Atrás
          </button>
        </div>
      </div>

      <div className="rounded-[18px] border border-black/[0.08] bg-white/85 p-[18px] shadow-[0_10px_30px_rgba(0,0,0,0.06)] mt-4">
        <div className="text-lg font-black mb-2.5">📄 Plantillas</div>

        {templates.length === 0 ? (
          <div className="opacity-75">Esta biblioteca no tiene plantillas aún.</div>
        ) : (
          <div className="grid gap-2.5">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex justify-between items-center gap-3 px-[14px] py-3 rounded-[14px] border border-black/[0.08] bg-black/[0.02]"
              >
                <div>
                  <div className="font-black text-[15px]">{t.name}</div>
                  <div className="opacity-70 text-xs mt-0.5">{t.description ?? "—"}</div>
                </div>

                <div className="flex gap-2.5 items-center">
                  <button
                    className="px-[14px] py-2.5 rounded-xl border border-black/20 bg-black text-white font-black cursor-pointer text-sm"
                    onClick={() => setOpenTemplateId(t.id)}
                  >
                    Ver
                  </button>
                  <button
                    className="px-[14px] py-2.5 rounded-xl border border-black/[0.18] bg-white text-black font-black cursor-pointer text-sm"
                    onClick={() => {
                      toast.warn("Aquí luego irá 'Importar plantilla'");
                    }}
                  >
                    Importar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {openTemplateId && (
        <div
          className="fixed inset-0 bg-black/35 flex items-center justify-center p-[18px] z-50"
          onClick={() => setOpenTemplateId(null)}
        >
          <div
            className="w-[min(980px,100%)] rounded-[18px] bg-white border border-black/[0.12] shadow-[0_20px_60px_rgba(0,0,0,0.25)] p-[18px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between gap-3 items-start flex-wrap">
              <div>
                <div className="font-black text-lg">{openTemplate?.name ?? "Plantilla"}</div>
                <div className="opacity-70 mt-1 text-[13px]">{openTemplate?.description ?? "—"}</div>
              </div>
              <button
                className="px-[14px] py-2.5 rounded-xl border border-black/[0.18] bg-white text-black font-black cursor-pointer text-sm"
                onClick={() => setOpenTemplateId(null)}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-[14px]">
              {modalLoading ? (
                <div className="opacity-80">Cargando contenido…</div>
              ) : modalError ? (
                <div className="text-[crimson] font-black">{modalError}</div>
              ) : sections.length === 0 ? (
                <div className="opacity-75">Esta plantilla todavía no tiene secciones.</div>
              ) : (
                <div className="grid gap-2.5">
                  {sections.map((s) => {
                    const qs = questions.filter((q) => q.section_id === s.id);
                    return (
                      <div
                        key={s.id}
                        className="rounded-[14px] border border-black/[0.08] bg-black/[0.02] p-3"
                      >
                        <div className="flex justify-between gap-3 items-baseline flex-wrap">
                          <div className="font-black">{s.name}</div>
                          <div className="opacity-70 text-xs">{qs.length} preguntas</div>
                        </div>

                        {qs.length > 0 && (
                          <div className="mt-2.5 grid gap-1.5">
                            {qs.slice(0, 10).map((q) => (
                              <div
                                key={q.id}
                                className="px-2.5 py-2 rounded-xl bg-white border border-black/[0.06] text-[13px]"
                              >
                                {q.text}
                              </div>
                            ))}
                            {qs.length > 10 && (
                              <div className="opacity-70 text-xs">…y {qs.length - 10} más</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
