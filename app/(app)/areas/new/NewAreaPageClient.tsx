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
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 18 }}>Nueva área</h1>

      {error ? (
        <div style={{ padding: 12, border: "1px solid #f00", borderRadius: 8, marginBottom: 14 }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>Nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Housekeeping"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>Tipo</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
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

        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button
            onClick={() => router.push("/areas")}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onCreate}
            disabled={saving}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #000",
              background: "#000",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Creando..." : "Crear área"}
          </button>
        </div>
      </div>

      <p style={{ marginTop: 18, fontSize: 12, opacity: 0.7 }}>
        Hotel: <span style={{ fontFamily: "monospace" }}>{hotelId}</span> · Rol:{" "}
        <b>{profile.role}</b>
      </p>
    </main>
  );
}
