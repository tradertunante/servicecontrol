"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type AreaOption = {
  id: string;
  name: string;
  type: string | null;
};

type Props = {
  label?: string;
  placeholder?: string;

  options: AreaOption[];
  value: string[];
  onChange: (nextIds: string[]) => void;

  disabledIds?: string[];
  className?: string;
  hint?: string;
};

function formatArea(a: AreaOption) {
  const t = (a.type ?? "").trim();
  return t ? `${a.name} · ${t}` : a.name;
}

export default function AreaMultiSelect({
  label = "Áreas (puede tener varias)",
  placeholder = "Añadir área…",
  options,
  value,
  onChange,
  disabledIds = [],
  className = "",
  hint,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const disabledSet = useMemo(() => new Set(disabledIds), [disabledIds]);

  const selectedOptions = useMemo(() => {
    const map = new Map(options.map((o) => [o.id, o]));
    return value.map((id) => map.get(id)).filter(Boolean) as AreaOption[];
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? options.filter((o) => {
          const hay = `${o.name} ${o.type ?? ""}`.toLowerCase();
          return hay.includes(q);
        })
      : options;

    const list = base
      .slice(0, 60)
      .sort((a, b) => {
        const aBlocked = selectedSet.has(a.id) || disabledSet.has(a.id);
        const bBlocked = selectedSet.has(b.id) || disabledSet.has(b.id);
        if (aBlocked !== bBlocked) return aBlocked ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

    return list;
  }, [options, query, selectedSet, disabledSet]);

  const canPick = (id: string) => !selectedSet.has(id) && !disabledSet.has(id);

  function pick(id: string) {
    if (!canPick(id)) return;
    onChange([...value, id]);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function remove(id: string) {
    onChange(value.filter((x) => x !== id));
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (!wrapRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) pick(item.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Backspace") {
      if (!query && value.length) remove(value[value.length - 1]);
    }
  }

  return (
    <div ref={wrapRef} className={`w-full ${className}`}>
      {label ? (
        <div className="mb-2 text-sm font-extrabold text-gray-900">{label}</div>
      ) : null}

      {selectedOptions.length ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedOptions.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm font-semibold shadow-sm"
            >
              <span className="text-gray-900">{formatArea(a)}</span>
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="grid h-6 w-6 place-items-center rounded-full border bg-gray-50 text-gray-700 hover:bg-gray-100"
                aria-label="Quitar"
                title="Quitar"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <div
          className={[
            "flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm",
            open ? "border-black" : "border-gray-200",
          ].join(" ")}
        >
          <span className="text-gray-400">🔎</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="w-full bg-transparent text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400"
          />

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-xl border bg-white px-3 py-1.5 text-sm font-extrabold hover:bg-gray-50"
          >
            {open ? "Cerrar" : "Ver"}
          </button>
        </div>

        {open ? (
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border bg-white shadow-lg">
            <div className="max-h-64 overflow-auto p-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-sm font-semibold text-gray-600">
                  No hay resultados.
                </div>
              ) : (
                filtered.map((o, idx) => {
                  const blocked = !canPick(o.id);
                  const active = idx === activeIndex;

                  return (
                    <button
                      type="button"
                      key={o.id}
                      disabled={blocked}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => pick(o.id)}
                      className={[
                        "w-full text-left rounded-xl px-3 py-2 transition",
                        active ? "bg-gray-100" : "bg-white",
                        blocked ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100",
                      ].join(" ")}
                    >
                      <div className="text-sm font-extrabold text-gray-900">{o.name}</div>
                      <div className="text-xs font-semibold text-gray-500">
                        {o.type ? o.type : "Sin tipo"}
                        {blocked ? " · (ya asignada)" : ""}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
              {hint ?? "Enter para añadir · Backspace quita la última · Esc cierra"}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}