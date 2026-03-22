"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/types";

export default function NewAreaPageClient({
  profile,
  hotelId,
}: {
  profile: Profile;
  hotelId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("HK");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCreate = async () => {
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError("Pon un nombre de área.");
      return;
    }

    setSaving(true);

    const { error: insertError } = await supabase.from("areas").insert({
      hotel_id: hotelId,
      name: cleanName,
      type,
      active: true,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push("/areas");
  };

  return (
    <main className="p-6 font-[system-ui]">
      <h1 className="text-[22px] font-[800] mb-[18px]">Nueva área</h1>

      {error ? (
        <div className="p-3 border border-red-600 rounded-lg mb-[14px]">
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div className="grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-[13px] opacity-80">Nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Housekeeping"
            className="p-2.5 rounded-lg border border-[#ddd]"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[13px] opacity-80">Tipo</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="p-2.5 rounded-lg border border-[#ddd]"
          >
            <option value="HK">HK - Housekeeping</option>
            <option value="FO">FO - Front Office</option>
            <option value="F&B">F&B - Food & Beverage</option>
            <option value="SPA">SPA</option>
            <option value="ENG">ENG - Engineering</option>
            <option value="SEC">SEC - Security</option>
            <option value="OTH">OTH - Other</option>
          </select>
        </label>

        <div className="flex gap-2.5 mt-1.5">
          <button
            onClick={() => router.push("/areas")}
            className="px-[14px] py-2.5 rounded-lg border border-[#ddd] bg-white cursor-pointer font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={onCreate}
            disabled={saving}
            className="px-[14px] py-2.5 rounded-lg border border-black bg-black text-white cursor-pointer font-bold"
            style={{ opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Creando..." : "Crear área"}
          </button>
        </div>
      </div>

      <p className="mt-[18px] text-xs opacity-70">
        Hotel: <span className="font-mono">{hotelId}</span> · Rol:{" "}
        <b>{profile.role}</b>
      </p>
    </main>
  );
}
