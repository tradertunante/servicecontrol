"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAuditSessionContext } from "../_context/AuditSessionContext";
import AuditHeader from "./AuditHeader";
import AuditQuestionCard from "./AuditQuestionCard";
import AuditStickyFooter from "./AuditStickyFooter";
import DesktopAuditLayout from "./DesktopAuditLayout";
import MobileAuditLayout from "./MobileAuditLayout";

function fmtDate(iso: string | null) {
  if (!iso) return "Sin fecha";
  const date = new Date(iso);
  return date.toLocaleString("es-ES", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditPageShell() {
  const {
    run,
    template,
    area,
    sections,
    groupedQuestions,
    answersByQ,
    teamMembers,
    selectedMember,
    roomNumber,
    savingRoomNumber,
    employeeName,
    setEmployeeName,
    saveEmployeeName,
    savingEmployeeName,
    requiresRoomNumber,
    requiresAuditedEmployee,
    showRoomNumberField,
    saving,
    uploading,
    submitting,
    savingMember,
    submitted,
    isOnline,
    error,
    activeQuestionId,
    activeSectionId,
    canGoPrevious,
    canGoNext,
    onSelectSection,
    saveTeamMember: onSelectMember,
    setRoomNumber: onChangeRoomNumber,
    saveRoomNumber: onSaveRoomNumber,
    setAnswer: onSelectAnswer,
    setComment: onChangeComment,
    uploadPhoto: onUploadPhoto,
    deletePhoto: onDeletePhoto,
    onPreviousQuestion,
    onNextQuestion,
    submitRun: onSubmit,
  } = useAuditSessionContext();

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!activeQuestionId) return;
    const node = questionRefs.current[activeQuestionId];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeQuestionId]);

  const totalQuestions = useMemo(
    () => sections.reduce((sum, section) => sum + (groupedQuestions[section.id]?.length ?? 0), 0),
    [groupedQuestions, sections]
  );

  // run is guaranteed non-null by the guard in page.tsx; this early return
  // keeps TypeScript happy without unsafe assertions.
  if (!run) return null;

  const header = (
    <div className="space-y-2 bg-slate-50">
      <AuditHeader
        title={template?.name ?? "Auditoría"}
        subtitle={`${area?.name ?? "—"}${area?.type ? ` · ${area.type}` : ""}`}
        meta={`Fecha: ${fmtDate(run.executed_at ?? null)}`}
        roomNumber={run.room_number}
      />
    </div>
  );

  const content = (
    <div className="flex flex-col gap-2.5">
      {!isOnline ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-extrabold text-amber-800">
          Sin conexión — tus respuestas se guardan localmente y se sincronizarán al reconectar.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-extrabold text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 lg:rounded-3xl lg:p-4">
        <div className="mb-2 text-sm font-extrabold text-slate-900">Colaborador auditado</div>
        {requiresAuditedEmployee ? (
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-amber-700">
            Obligatorio para enviar
          </div>
        ) : null}
        <select
          value={selectedMember}
          disabled={submitted || savingMember}
          onChange={(event) => onSelectMember(event.target.value)}
          className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 disabled:opacity-60"
        >
          <option value="">Auditoría general (sin colaborador)</option>
          {(() => {
            const templateMembers = teamMembers.filter((m) => m.member_affinity === "template");
            const areaMembers = teamMembers.filter((m) => m.member_affinity === "area");
            const otherMembers = teamMembers.filter((m) => m.member_affinity === "other");
            return (
              <>
                {templateMembers.length > 0 && (
                  <optgroup label="Equipo habitual">
                    {templateMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </optgroup>
                )}
                {areaMembers.length > 0 && (
                  <optgroup label="Mismo área">
                    {areaMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </optgroup>
                )}
                {otherMembers.length > 0 && (
                  <optgroup label="Otros">
                    {otherMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name} (fuera del área)</option>
                    ))}
                  </optgroup>
                )}
              </>
            );
          })()}
        </select>

        {/* Free-text collaborator name — always visible as an optional complement */}
        <div className="mt-3">
          <div className="mb-1.5 text-sm font-extrabold text-slate-900">
            Nombre del colaborador <span className="font-normal text-slate-400">(opcional)</span>
          </div>
          <input
            type="text"
            placeholder="Escribe el nombre si no está en la lista"
            value={employeeName}
            disabled={submitted || savingEmployeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            onBlur={(e) => saveEmployeeName(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 disabled:opacity-60"
          />
          {savingEmployeeName && (
            <div className="mt-1 text-[11px] text-slate-400">Guardando…</div>
          )}
        </div>

        {showRoomNumberField ? (
          <div className="mt-3">
            <div className="mb-2 text-sm font-extrabold text-slate-900">Room number</div>
            {requiresRoomNumber ? (
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                Obligatorio para enviar
              </div>
            ) : null}
            <input
              value={roomNumber}
              disabled={submitted || savingRoomNumber}
              onChange={(event) => onChangeRoomNumber(event.target.value)}
              onBlur={(event) => onSaveRoomNumber(event.target.value)}
              placeholder="Ej. 1204A"
              className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 disabled:opacity-60"
            />
          </div>
        ) : null}
      </div>

      <div data-onboarding="audit-questions">
      {sections.map((section) => {
        const questions = groupedQuestions[section.id] ?? [];
        if (!questions.length) return null;

        return (
          <section key={section.id} className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">
                {section.name}
              </h2>
              <button
                type="button"
                onClick={() => onSelectSection(section.id)}
                className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide ${
                  activeSectionId === section.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                Ir
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {questions.map((question) => (
                <div
                  key={question.id}
                  ref={(node) => {
                    questionRefs.current[question.id] = node;
                  }}
                >
                  <AuditQuestionCard
                    question={question}
                    answer={answersByQ[question.id] ?? null}
                    active={activeQuestionId === question.id}
                    disabled={submitted}
                    uploading={uploading}
                    onAnswerChange={(value) => onSelectAnswer(question.id, value)}
                    onCommentChange={(value) => onChangeComment(question.id, value)}
                    onPhotoUpload={(file) => onUploadPhoto(question.id, file)}
                    onPhotoDelete={(index) => onDeletePhoto(question.id, index)}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {totalQuestions === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-sm font-semibold text-slate-700">
          No hay preguntas activas en esta auditoría.
        </div>
      ) : null}
      </div>
    </div>
  );

  const footer = (
    <AuditStickyFooter
      submitting={submitting}
      submitted={submitted}
      saving={saving}
      onSave={onSubmit}
    />
  );

  return (
    <>
      <MobileAuditLayout header={header} content={content} footer={footer} />
      <DesktopAuditLayout header={header} content={content} footer={footer} />
    </>
  );
}
