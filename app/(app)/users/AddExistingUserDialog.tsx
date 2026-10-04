"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const ROLE_OPTIONS = [
  "admin",
  "general_manager",
  "manager",
  "auditor",
  "quality",
  "engineering",
  "it",
  "systems",
] as const;

type Props = {
  onClose: () => void;
  onAdded: () => void;
};

// Añade a este hotel un usuario que ya tiene cuenta (por ejemplo, de otro hotel).
export default function AddExistingUserDialog({ onClose, onAdded }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("auditor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    setDone("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error("Sesión inválida.");

      const res = await fetch("/api/admin/users/add-existing", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "No se pudo añadir el usuario.");

      setDone(`Añadido: ${json.user?.full_name || json.user?.email} como ${role}.`);
      setEmail("");
      onAdded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo añadir el usuario.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="add-existing-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="add-existing-title" className="text-xl font-bold">Añadir usuario existente</h2>
        <p className="mt-1 text-sm opacity-75">
          El usuario ya debe tener cuenta. Se añade a este hotel con el rol que elijas y conserva sus otros hoteles.
        </p>

        <label className="mt-4 flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            className="rounded-lg border border-black/20 px-3 py-2"
            placeholder="persona@hotel.com"
          />
        </label>

        <label className="mt-3 flex flex-col gap-1 text-sm">
          Rol en este hotel
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as (typeof ROLE_OPTIONS)[number])}
            disabled={busy}
            className="rounded-lg border border-black/20 px-3 py-2"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>

        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        {done && <p role="status" className="mt-3 text-sm text-green-700">{done}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-black/20 px-4 py-2 text-sm">
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => { void submit(); }}
            disabled={busy || !email.trim()}
            className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Añadiendo…" : "Añadir"}
          </button>
        </div>
      </div>
    </div>
  );
}
