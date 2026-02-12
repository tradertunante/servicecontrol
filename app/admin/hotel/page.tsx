// app/admin/hotel/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BackButton from "@/app/components/BackButton";
import HotelHeader from "@/app/components/HotelHeader";

type Hotel = {
  id: string;
  name: string;
  created_at: string | null;
};

export default function HotelInfoPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [hotelName, setHotelName] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        // Verificar autenticación y rol
        const { data: { user }, error: userErr } = await supabase.auth.getUser();

        if (userErr || !user) {
          router.push("/login");
          return;
        }

        // Obtener perfil
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("role, hotel_id")
          .eq("id", user.id)
          .single();

        if (profileErr || !profile) {
          setError("No se pudo cargar el perfil.");
          setLoading(false);
          return;
        }

        // Verificar que sea admin
        if (profile.role !== "admin") {
          router.push("/dashboard");
          return;
        }

        if (!profile.hotel_id) {
          setError("No tienes un hotel asignado.");
          setLoading(false);
          return;
        }

        // Cargar información del hotel
        const { data: hotelData, error: hotelErr } = await supabase
          .from("hotels")
          .select("id, name, created_at")
          .eq("id", profile.hotel_id)
          .single();

        if (hotelErr || !hotelData) {
          setError("No se pudo cargar la información del hotel.");
          setLoading(false);
          return;
        }

        setHotel(hotelData as Hotel);
        setHotelName(hotelData.name || "");
        setLoading(false);
      } catch (e: any) {
        setError(e?.message || "Error al cargar la información.");
        setLoading(false);
      }
    })();
  }, [router]);

  async function saveHotelName() {
    if (!hotel) return;

    const newName = hotelName.trim();
    if (!newName) {
      setError("El nombre del hotel no puede estar vacío.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateErr } = await supabase
        .from("hotels")
        .update({ name: newName })
        .eq("id", hotel.id);

      if (updateErr) throw updateErr;

      setHotel({ ...hotel, name: newName });
      setSuccess("¡Nombre del hotel actualizado correctamente! El cambio se verá reflejado en el header.");
      
      // Forzar recarga del header después de 1 segundo
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar el nombre del hotel.");
    } finally {
      setSaving(false);
    }
  }

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    padding: 18,
  };

  const btn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    height: 42,
  };

  if (loading) {
    return (
      <main style={{ padding: 24, paddingTop: 80 }}>
        <HotelHeader />
        <BackButton fallback="/admin" />
        <h1 style={{ fontSize: 56, marginBottom: 6 }}>Info del Hotel</h1>
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  if (error && !hotel) {
    return (
      <main style={{ padding: 24, paddingTop: 80 }}>
        <HotelHeader />
        <BackButton fallback="/admin" />
        <h1 style={{ fontSize: 56, marginBottom: 6 }}>Info del Hotel</h1>
        <div style={{ color: "crimson", fontWeight: 900, marginTop: 12 }}>{error}</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <HotelHeader />
      <BackButton fallback="/admin" />

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 56, marginBottom: 6 }}>Info del Hotel</h1>
        <div style={{ opacity: 0.85, fontWeight: 900 }}>
          Administra la información general del hotel.
        </div>
      </div>

      {error && <div style={{ marginTop: 12, color: "crimson", fontWeight: 950 }}>{error}</div>}
      {success && <div style={{ marginTop: 12, color: "green", fontWeight: 950 }}>{success}</div>}

      <div style={card}>
        <div style={{ fontWeight: 950, fontSize: 20, marginBottom: 14 }}>
          Datos del hotel
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ fontWeight: 900, marginBottom: 8, display: "block" }}>
              Nombre del hotel
            </label>
            <input
              type="text"
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              placeholder="Ej: Hotel Paradise"
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
            <div style={{ marginTop: 6, opacity: 0.7, fontSize: 13 }}>
              Este nombre aparecerá en el header de todas las páginas.
            </div>
          </div>

          <div>
            <label style={{ fontWeight: 900, marginBottom: 8, display: "block" }}>
              ID del hotel
            </label>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "rgba(0,0,0,0.04)",
                fontWeight: 700,
                fontSize: 14,
                opacity: 0.8,
                maxWidth: 500,
              }}
            >
              {hotel?.id}
            </div>
            <div style={{ marginTop: 6, opacity: 0.7, fontSize: 13 }}>
              Identificador único del hotel (no se puede modificar).
            </div>
          </div>

          {hotel?.created_at && (
            <div>
              <label style={{ fontWeight: 900, marginBottom: 8, display: "block" }}>
                Fecha de creación
              </label>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(0,0,0,0.04)",
                  fontWeight: 700,
                  fontSize: 14,
                  opacity: 0.8,
                  maxWidth: 500,
                }}
              >
                {new Date(hotel.created_at).toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "2-digit",
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <button
              onClick={saveHotelName}
              disabled={saving || hotelName.trim() === hotel?.name}
              style={{
                ...btn,
                opacity: saving || hotelName.trim() === hotel?.name ? 0.5 : 1,
                cursor: saving || hotelName.trim() === hotel?.name ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ ...card, marginTop: 14, background: "rgba(255, 243, 205, 0.5)" }}>
        <div style={{ fontWeight: 950, fontSize: 16, marginBottom: 8 }}>
          💡 Nota importante
        </div>
        <div style={{ opacity: 0.85, fontSize: 14, lineHeight: 1.6 }}>
          Al cambiar el nombre del hotel, este se actualizará automáticamente en el header de todas las páginas
          para todos los usuarios asociados a este hotel.
        </div>
      </div>
    </main>
  );
}