"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import QualityThresholdsCard from "./QualityThresholdsCard";

type HotelRow = {
  id: string;
  name: string | null;
  created_at: string | null;
};

export default function HotelInfoModule({ hotelId }: { hotelId: string }) {
  const [hotel, setHotel] = useState<HotelRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  async function load() {
    setError("");
    setHotel(null);

    if (!hotelId) {
      setError("No hay hotel seleccionado.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("hotels")
        .select("id, name, created_at")
        .eq("id", hotelId)
        .single();

      if (error) throw error;
      setHotel((data ?? null) as HotelRow | null);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar la info del hotel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  function startEdit() {
    setSaveError("");
    setSavedMsg("");
    setNameInput(hotel?.name ?? "");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError("");
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) { setSaveError("El nombre es obligatorio."); return; }

    setSaving(true);
    setSaveError("");
    setSavedMsg("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) { setSaveError("Sesión inválida."); setSaving(false); return; }

    const res = await fetch("/api/admin/hotel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ name }),
    });
    const payload = await res.json().catch(() => null);

    setSaving(false);

    if (!res.ok) {
      setSaveError(payload?.error ?? "No se pudo guardar.");
      return;
    }

    setHotel((prev) => prev ? { ...prev, name: payload.name } : prev);
    setEditing(false);
    setSavedMsg("Nombre actualizado.");
    setTimeout(() => setSavedMsg(""), 3000);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--card-bg)",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Cargando…" : "Recargar"}
        </button>
      </div>

      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(220,0,0,0.35)",
            background: "rgba(220,0,0,0.06)",
            color: "crimson",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "var(--shadow-sm)",
          padding: 16,
        }}
      >
        <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 950 }}>Hotel Info</div>
            <div style={{ marginTop: 4, opacity: 0.72 }}>
              Información básica del hotel seleccionado.
            </div>
          </div>
          {!editing && hotel ? (
            <button
              onClick={startEdit}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--card-bg)",
                fontWeight: 900,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Editar nombre
            </button>
          ) : null}
        </div>

        {editing ? (
          <form onSubmit={saveName} style={{ display: "grid", gap: 10, maxWidth: 400 }}>
            <div>
              <label style={{ fontWeight: 800, fontSize: 13, display: "block", marginBottom: 6 }}>
                Nombre del hotel
              </label>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--card-bg)",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              />
            </div>
            {saveError ? (
              <div style={{ color: "crimson", fontWeight: 800, fontSize: 13 }}>{saveError}</div>
            ) : null}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "black",
                  color: "white",
                  fontWeight: 900,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            <Info label="Nombre" value={hotel?.name ?? "—"} />
            <Info
              label="Creado"
              value={
                hotel?.created_at ? new Date(hotel.created_at).toLocaleString() : "—"
              }
            />
          </div>
        )}

        {savedMsg ? (
          <div style={{ marginTop: 10, color: "green", fontWeight: 800, fontSize: 13 }}>{savedMsg}</div>
        ) : null}
      </div>

      <QualityThresholdsCard hotelId={hotelId} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "rgba(0,0,0,0.02)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 950, wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}