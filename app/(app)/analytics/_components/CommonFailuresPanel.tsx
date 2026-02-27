"use client";

import type { CommonStandardRow } from "../_lib/analyticsTypes";

function StandardCard({ row }: { row: CommonStandardRow }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div style={{ minWidth: 0 }}>
          <div className="text-sm font-extrabold text-gray-900 break-words">{row.standard}</div>
          <div className="mt-1 text-xs font-semibold text-gray-600">
            {row.tag || row.classification ? (
              <>
                {row.tag ? (
                  <span className="mr-2">
                    <span className="font-extrabold text-gray-700">Tag:</span> {row.tag}
                  </span>
                ) : null}
                {row.classification ? (
                  <span>
                    <span className="font-extrabold text-gray-700">Clasificación:</span> {row.classification}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="rounded-full border bg-gray-50 px-3 py-1 text-xs font-extrabold text-gray-800">
            {row.affected_members} personas
          </span>
          <span className="rounded-full border bg-gray-50 px-3 py-1 text-xs font-extrabold text-gray-800">
            {row.fail_count} FAIL
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CommonFailuresPanel({
  summary,
  commonByPeople,
  commonByFails,
}: {
  summary: string;
  commonByPeople: CommonStandardRow[];
  commonByFails: CommonStandardRow[];
}) {
  return (
    <section className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold">Fallos comunes</div>
          <div className="mt-1 text-xs font-semibold text-gray-500">
            Mostrando <span className="font-extrabold">estándares (preguntas)</span> fallados en el periodo.
          </div>
        </div>

        <div className="rounded-2xl border bg-gray-50 px-3 py-2 text-xs font-extrabold text-gray-700">
          {summary}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-gray-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-gray-900">Fallados por más personas</div>
              <div className="mt-1 text-xs font-semibold text-gray-600">
                Solo estándares con <span className="font-extrabold">&gt; 1</span> colaborador afectado.
              </div>
            </div>
            <div className="rounded-full border bg-white px-3 py-1 text-xs font-extrabold text-gray-700">
              Top {commonByPeople.length}
            </div>
          </div>

          {commonByPeople.length === 0 ? (
            <div className="mt-3 text-sm font-semibold text-gray-600">
              No hay estándares fallados por más de una persona.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {commonByPeople.map((r, idx) => (
                <StandardCard key={`${r.question_id}-${idx}`} row={r} />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-gray-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-gray-900">Fallados más veces</div>
              <div className="mt-1 text-xs font-semibold text-gray-600">
                Ordenado por volumen total de FAIL en distintas auditorías.
              </div>
            </div>
            <div className="rounded-full border bg-white px-3 py-1 text-xs font-extrabold text-gray-700">
              Top {commonByFails.length}
            </div>
          </div>

          {commonByFails.length === 0 ? (
            <div className="mt-3 text-sm font-semibold text-gray-600">Sin fallos en este periodo.</div>
          ) : (
            <div className="mt-3 space-y-3">
              {commonByFails.map((r, idx) => (
                <StandardCard key={`${r.question_id}-${idx}`} row={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}