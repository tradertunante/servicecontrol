// app/areas/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";
import BackButton from "@/app/components/BackButton";

type Profile = {
  id: string;
  full_name?: string | null;
  role: string;
  hotel_id: string | null;
};

type Area = {
  id: string;
  name: string;
  type: string | null;
  created_at: string;
};

export default function AreasPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [q, setQ] = useState("");

  // Estado del formulario de nueva área
  const [showForm, setShowForm] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaType, setNewAreaType] = useState("");

  useEffect(() => {
    loadAreas();
  }, [router]);

  async function loadAreas() {
    setLoading(true);
    setError(null);

    try {
      const p = await requireRoleOrRedirect(router, ["admin", "manager"], "/dashboard");
      if (!p) return;

      setProfile(p);

      if (!p.hotel_id) {
        setError("No tienes un hotel asignado.");
        setLoading(false);
        return;
      }

      const { data: areasData, error: areasErr } = await supabase
        .from("areas")
        .select("id, name, type, created_at")
        .eq("hotel_id", p.hotel_id)
        .order("name", { ascending: true });

      if (areasErr) throw areasErr;

      setAreas((areasData ?? []) as Area[]);
      setLoading(false);
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar áreas.");
      setLoading(false);
    }
  }

  async function handleCreateArea() {
    if (!newAreaName.trim()) {
      setError("El nombre del área no puede estar vacío.");
      return;
    }

    if (!profile?.hotel_id) {
      setError("No tienes un hotel asignado.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: insertErr } = await supabase.from("areas").insert({
        name: newAreaName.trim(),
        type: newAreaType.trim() || null,
        hotel_id: profile.hotel_id,
      });

      if (insertErr) throw insertErr;

      setSuccess("¡Área creada exitosamente!");
      setNewAreaName("");
      setNewAreaType("");
      setShowForm(false);

      // Recargar áreas
      await loadAreas();

      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo crear el área.");
    } finally {
      setSaving(false);
    }
  }

  const filteredAreas = areas.filter((a) => {
    const search = q.toLowerCase().trim();
    if (!search) return true;
    return (
      a.name.toLowerCase().includes(search) ||
      a.type?.toLowerCase().includes(search) ||
      a.id.toLowerCase().includes(search)
    );
  });

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  };

  const btn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
  };

  const btnWhite: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
  };

  if (loading) {
    return (
      <main style={{ padding: 24, paddingTop: 80 }}>
        <HotelHeader />
        <BackButton fallback="/dashboard" />
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <HotelHeader />
      <BackButton fallback="/dashboard" />

      <div style={{ marginBottom: 20 }}>
        <div style={{ opacity: 0.7, fontSize: 14 }}>
          Rol: <strong>{profile?.role}</strong>
        </div>
      </div>

      {error && <div style={{ marginBottom: 12, color: "crimson", fontWeight: 950 }}>{error}</div>}
      {success && <div style={{ marginBottom: 12, color: "green", fontWeight: 950 }}>{success}</div>}

      {/* Header con búsqueda y botón */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, tipo o ID..."
          style={{
            flex: 1,
            minWidth: 250,
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.2)",
            outline: "none",
            fontWeight: 800,
          }}
        />

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ opacity: 0.7, fontWeight: 900 }}>Total: {areas.length}</div>
          <button onClick={() => setShowForm(!showForm)} style={btn}>
            {showForm ? "Cancelar" : "+ Nueva Área"}
          </button>
        </div>
      </div>

      {/* Formulario de nueva área */}
      {showForm && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 16 }}>Crear Nueva Área</div>

          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={{ fontWeight: 900, marginBottom: 8, display: "block" }}>
                Nombre del área *
              </label>
              <input
                type="text"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="Ej: Housekeeping, Restaurante, Spa..."
                style={{
                  width: "100%",
                  maxWidth: 500,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.18)",
                  outline: "none",
                  fontWeight: 900,
                  fontSize: 16,
                }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 900, marginBottom: 8, display: "block" }}>
                Tipo (opcional)
              </label>
              <input
                type="text"
                value={newAreaType}
                onChange={(e) => setNewAreaType(e.target.value)}
                placeholder="Ej: Operaciones, F&B, Mantenimiento..."
                style={{
                  width: "100%",
                  maxWidth: 500,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.18)",
                  outline: "none",
                  fontWeight: 900,
                  fontSize: 16,
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                onClick={handleCreateArea}
                disabled={saving || !newAreaName.trim()}
                style={{
                  ...btn,
                  opacity: saving || !newAreaName.trim() ? 0.5 : 1,
                  cursor: saving || !newAreaName.trim() ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Creando..." : "Crear Área"}
              </button>

              <button onClick={() => setShowForm(false)} style={btnWhite}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de áreas */}
      <div style={{ display: "grid", gap: 14 }}>
        {filteredAreas.map((area) => (
          <div key={area.id} style={card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 950, marginBottom: 4 }}>{area.name}</div>
                {area.type && (
                  <div style={{ opacity: 0.7, fontWeight: 900, fontSize: 14, marginBottom: 8 }}>
                    {area.type} · Creada:{" "}
                    {new Date(area.created_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                )}
                <div
                  style={{
                    opacity: 0.5,
                    fontSize: 12,
                    fontFamily: "monospace",
                    marginTop: 4,
                  }}
                >
                  ID: {area.id}
                </div>
              </div>

              <button onClick={() => router.push(`/areas/${area.id}`)} style={btn}>
                Entrar
              </button>
            </div>
          </div>
        ))}

        {filteredAreas.length === 0 && (
          <div style={{ ...card, textAlign: "center", padding: 40 }}>
            <div style={{ opacity: 0.7, fontSize: 16 }}>
              {q ? "No se encontraron áreas con ese criterio de búsqueda." : "No hay áreas creadas."}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}