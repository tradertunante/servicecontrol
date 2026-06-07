"use client";

import { useId } from "react";

const MAX_PHOTOS = 5;

export default function AuditPhotoField({
  photos,
  disabled,
  uploading,
  required,
  onUpload,
  onDelete,
}: {
  photos: string[];
  disabled?: boolean;
  uploading?: boolean;
  required?: boolean;
  onUpload: (file: File) => void;
  onDelete: (index: number) => void;
}) {
  const inputId = useId();
  const canAdd = !disabled && !uploading && photos.length < MAX_PHOTOS;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-extrabold text-slate-900">
        Evidencia fotográfica{required ? " obligatoria" : ""}
        {photos.length > 0 && (
          <span className="ml-2 text-[11px] font-semibold text-slate-400">
            {photos.length}/{MAX_PHOTOS}
          </span>
        )}
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((url, index) => (
            <div key={url} className="relative rounded-xl overflow-hidden border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Foto ${index + 1}`}
                className="h-28 w-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onDelete(index)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white shadow"
                  title="Eliminar foto"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canAdd ? (
        <>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={!canAdd}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.currentTarget.value = "";
            }}
          />
          <label
            htmlFor={inputId}
            className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-sm font-extrabold text-slate-700 hover:border-slate-400 hover:bg-slate-100"
          >
            {uploading ? (
              "Subiendo…"
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {photos.length === 0 ? "Subir foto" : "Agregar foto"}
              </>
            )}
          </label>
        </>
      ) : photos.length >= MAX_PHOTOS ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-xs font-semibold text-slate-400">
          Máximo de fotos alcanzado ({MAX_PHOTOS})
        </div>
      ) : null}
    </div>
  );
}