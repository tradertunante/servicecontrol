"use client";

import { useEffect, useMemo, useRef } from "react";
import AuditHeader from "./AuditHeader";
import AuditQuestionCard from "./AuditQuestionCard";
import AuditStickyFooter from "./AuditStickyFooter";
import DesktopAuditLayout from "./DesktopAuditLayout";
import MobileAuditLayout from "./MobileAuditLayout";
import type {
  AnswerRow,
  AnswerValue,
  AuditRunRow,
  AreaRow,
  QuestionRow,
  SectionRow,
  TeamMemberLite,
  TemplateRow,
} from "../_hooks/useAuditSession";

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

export default function AuditPageShell({
  run,
  template,
  area,
  sections,
  groupedQuestions,
  answersByQ,
  teamMembers,
  selectedMember,
  saving,
  uploading,
  submitting,
  savingMember,
  submitted,
  error,
  activeQuestionId,
  activeSectionId,
  canGoPrevious,
  canGoNext,
  onSelectSection,
  onSelectMember,
  onSelectAnswer,
  onChangeComment,
  onUploadPhoto,
  onDeletePhoto,
  onPreviousQuestion,
  onNextQuestion,
  onSubmit,
}: {
  run: AuditRunRow;
  template: TemplateRow | null;
  area: AreaRow | null;
  sections: SectionRow[];
  groupedQuestions: Record<string, QuestionRow[]>;
  answersByQ: Record<string, AnswerRow>;
  teamMembers: TeamMemberLite[];
  selectedMember: string;
  saving: boolean;
  uploading: boolean;
  submitting: boolean;
  savingMember: boolean;
  submitted: boolean;
  error: string | null;
  activeQuestionId: string | null;
  activeSectionId: string | null;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onSelectSection: (sectionId: string) => void;
  onSelectMember: (memberId: string) => void;
  onSelectAnswer: (questionId: string, value: AnswerValue) => void;
  onChangeComment: (questionId: string, value: string) => void;
  onUploadPhoto: (questionId: string, file: File) => void;
  onDeletePhoto: (questionId: string) => void;
  onPreviousQuestion: () => void;
  onNextQuestion: () => void;
  onSubmit: () => void;
}) {
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!activeQuestionId) return;
    const node = questionRefs.current[activeQuestionId];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeQuestionId]);

  const header = (
    <div className="space-y-2 bg-slate-50">
      <AuditHeader
        title={template?.name ?? "Auditoría"}
        subtitle={`${area?.name ?? "—"}${area?.type ? ` · ${area.type}` : ""}`}
        meta={`Fecha: ${fmtDate(run.executed_at ?? null)}`}
      />
    </div>
  );

  const content = (
    <div className="flex flex-col gap-2.5">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-extrabold text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 lg:rounded-3xl lg:p-4">
        <div className="mb-2 text-sm font-extrabold text-slate-900">Colaborador auditado</div>
        <select
          value={selectedMember}
          disabled={submitted || savingMember}
          onChange={(event) => onSelectMember(event.target.value)}
          className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 disabled:opacity-60"
        >
          <option value="">Auditoría general (sin colaborador)</option>
          {teamMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name}
              {member._outOfArea ? " (fuera del área)" : ""}
            </option>
          ))}
        </select>
      </div>

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
                    onPhotoDelete={() => onDeletePhoto(question.id)}
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
