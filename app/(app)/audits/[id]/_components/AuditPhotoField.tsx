"use client";

import { useId } from "react";

export default function AuditPhotoField({
  value,
  disabled,
  uploading,
  required,
  onUpload,
  onDelete,
}: {
  value: string | null;
  disabled?: boolean;
  uploading?: boolean;
  required?: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  const inputId = useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-extrabold text-slate-900">
          Evidencia fotográfica{required ? " obligatoria" : ""}
        </div>
      </div>

      {value ? (
        <div className="flex flex-col gap-3">
          <img
            src={value}
            alt="Evidencia"
            className="max-h-72 w-full rounded-2xl border border-slate-200 bg-white object-contain"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={onDelete}
            className="min-h-[48px] rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-extrabold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Eliminar foto
          </button>
        </div>
      ) : (
        <>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled || uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.currentTarget.value = "";
            }}
          />
          <label
            htmlFor={inputId}
            className={`flex min-h-[48px] cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-900 ${
              disabled || uploading ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            {uploading ? "Subiendo..." : "Subir foto"}
          </label>
        </>
      )}
    </div>
  );
}
