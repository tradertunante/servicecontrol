"use client";

import { useTranslations } from "next-intl";
import type { MemberAreaOption } from "../_lib/memberTypes";

type MemberFormValues = {
  full_name: string;
  employee_number: string;
  active: boolean;
  area_ids: string[];
};

const inputClasses =
  "border border-[#d1d5db] rounded-[10px] py-[10px] px-3 w-full bg-white";

function buttonClasses(disabled = false) {
  return [
    "border border-[#d1d5db]",
    disabled ? "bg-[#f3f4f6] text-[#9ca3af]" : "bg-[#111827] text-white",
    "py-[10px] px-3",
    "rounded-[10px]",
    "font-bold",
    disabled ? "cursor-not-allowed" : "cursor-pointer",
  ].join(" ");
}

const secondaryButtonClasses =
  "border border-[#d1d5db] bg-white text-[#111827] py-[10px] px-3 rounded-[10px] font-bold cursor-pointer";

export default function MemberForm({
  title,
  values,
  areaOptions,
  busy,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  values: MemberFormValues;
  areaOptions: MemberAreaOption[];
  busy: boolean;
  submitLabel: string;
  onChange: (next: MemberFormValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("app.members.form");

  return (
    <div className="border border-[#e5e7eb] bg-white p-4 rounded-[12px] grid gap-3">
      <div className="text-[18px] font-extrabold">{title}</div>

      <input
        value={values.full_name}
        onChange={(event) => onChange({ ...values, full_name: event.target.value })}
        placeholder={t("namePlaceholder")}
        className={inputClasses}
      />

      <input
        value={values.employee_number}
        onChange={(event) => onChange({ ...values, employee_number: event.target.value })}
        placeholder={t("numberPlaceholder")}
        className={inputClasses}
      />

      <label className="flex items-center gap-2 text-[14px]">
        <input
          type="checkbox"
          checked={values.active}
          onChange={(event) => onChange({ ...values, active: event.target.checked })}
        />
        {t("activeLabel")}
      </label>

      <div>
        <div className="font-bold mb-2">{t("areasLabel")}</div>
        <div className="grid gap-2">
          {areaOptions.map((area) => {
            const checked = values.area_ids.includes(area.id);
            return (
              <label key={area.id} className="flex items-center gap-2 text-[14px]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const nextAreaIds = event.target.checked
                      ? [...values.area_ids, area.id]
                      : values.area_ids.filter((areaId) => areaId !== area.id);
                    onChange({ ...values, area_ids: nextAreaIds });
                  }}
                />
                {area.name}
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={onSubmit} disabled={busy} className={buttonClasses(busy)}>
          {busy ? t("saving") : submitLabel}
        </button>
        {onCancel ? (
          <button onClick={onCancel} type="button" className={secondaryButtonClasses}>
            {t("cancel")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
