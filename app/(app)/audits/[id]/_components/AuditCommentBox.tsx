"use client";

export default function AuditCommentBox({
  value,
  disabled,
  required,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-extrabold text-slate-900">
          Comentario{required ? " obligatorio" : ""}
        </div>
        <div className="text-[11px] font-semibold text-slate-500">Autosave</div>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="Escribe observaciones o evidencia adicional..."
        className="min-h-[104px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 disabled:opacity-60"
      />
    </div>
  );
}
