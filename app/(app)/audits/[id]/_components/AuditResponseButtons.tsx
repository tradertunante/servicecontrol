"use client";

import type { AnswerValue } from "../_hooks/useAuditSession";

export default function AuditResponseButtons({
  value,
  disabled,
  onChange,
}: {
  value: AnswerValue;
  disabled?: boolean;
  onChange: (value: AnswerValue) => void;
}) {
  const options: AnswerValue[] = ["PASS", "FAIL", "NA"];

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {options.map((option) => {
        const selected = value === option;
        const tone =
          option === "PASS"
            ? selected
              ? "border-emerald-700 bg-emerald-700 text-white"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
            : option === "FAIL"
              ? selected
                ? "border-rose-700 bg-rose-700 text-white"
                : "border-rose-200 bg-rose-50 text-rose-900"
              : selected
                ? "border-slate-700 bg-slate-700 text-white"
                : "border-slate-200 bg-slate-50 text-slate-900";

        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={`min-h-[48px] flex-1 rounded-2xl border px-4 text-sm font-extrabold transition ${tone} ${
              disabled ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
