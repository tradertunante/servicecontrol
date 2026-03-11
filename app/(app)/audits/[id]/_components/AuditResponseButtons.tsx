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
    <div className="grid grid-cols-3 gap-2">
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
            className={`min-h-[48px] min-w-0 rounded-xl border px-3 text-[13px] font-extrabold transition sm:rounded-2xl sm:px-4 sm:text-sm ${tone} ${
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
