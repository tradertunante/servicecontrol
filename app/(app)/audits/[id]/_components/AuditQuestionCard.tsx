"use client";

import AuditCommentBox from "./AuditCommentBox";
import AuditPhotoField from "./AuditPhotoField";
import AuditResponseButtons from "./AuditResponseButtons";
import type { AnswerRow, AnswerValue, QuestionRow } from "../_hooks/useAuditSession";

export default function AuditQuestionCard({
  question,
  answer,
  active,
  disabled,
  uploading,
  onAnswerChange,
  onCommentChange,
  onPhotoUpload,
  onPhotoDelete,
}: {
  question: QuestionRow;
  answer: AnswerRow | null;
  active: boolean;
  disabled?: boolean;
  uploading?: boolean;
  onAnswerChange: (value: AnswerValue) => void;
  onCommentChange: (value: string) => void;
  onPhotoUpload: (file: File) => void;
  onPhotoDelete: () => void;
}) {
  const selected = ((answer?.answer ?? answer?.result) ?? "PASS") as AnswerValue;
  const isFail = selected === "FAIL";
  const showComment =
    question.comment_requirement === "always" ||
    (question.comment_requirement === "if_fail" && isFail);
  const showPhoto =
    question.photo_requirement === "always" ||
    (question.photo_requirement === "if_fail" && isFail);
  const requireComment =
    question.comment_requirement === "always" ||
    (question.comment_requirement === "if_fail" && isFail);
  const requirePhoto =
    question.photo_requirement === "always" ||
    (question.photo_requirement === "if_fail" && isFail);

  return (
    <article
      className={`scroll-mt-44 rounded-2xl border bg-white p-3.5 shadow-sm transition lg:rounded-3xl lg:p-4 ${
        active ? "border-slate-900 ring-2 ring-slate-900/10" : "border-slate-200"
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold leading-snug text-slate-900">{question.text}</div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {question.comment_requirement !== "never" ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-600">
                Comentario
              </span>
            ) : null}
            {question.photo_requirement !== "never" ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-600">
                Foto
              </span>
            ) : null}
          </div>
        </div>

        <AuditResponseButtons value={selected} disabled={disabled} onChange={onAnswerChange} />

        {showComment ? (
          <AuditCommentBox
            value={answer?.comment ?? ""}
            disabled={disabled}
            required={requireComment}
            onChange={onCommentChange}
          />
        ) : null}

        {showPhoto ? (
          <AuditPhotoField
            value={answer?.photo_path ?? null}
            disabled={disabled}
            uploading={uploading}
            required={requirePhoto}
            onUpload={onPhotoUpload}
            onDelete={onPhotoDelete}
          />
        ) : null}
      </div>
    </article>
  );
}
