// FILE: app/(app)/audits/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { fetchActiveHotel } from "@/lib/auth/activeHotelClient";
import type { Profile } from "@/lib/types";

type AssignmentRow = {
  id: string;
  hotel_id?: string | null;
  area_id: string;
  audit_template_id: string;
  user_id: string;
  period: string;
  target_count: number;
  active: boolean | null;
};

type TemplateRow = {
  id: string;
  name: string | null;
};

type AreaRow = {
  id: string;
  name: string | null;
  hotel_id: string | null;
  type?: string | null;
};

function isHousekeepingArea(area: AreaRow | null): boolean {
  return (area?.type ?? "").toUpperCase() === "HK";
}

export default function NewAuditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const templateId = searchParams.get("template");

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [area, setArea] = useState<AreaRow | null>(null);
  const [roomNumber, setRoomNumber] = useState("");

  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !user) {
          router.replace("/login");
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, hotel_id, role, active, full_name")
          .eq("id", user.id)
          .single();

        if (profileError || !profileData || profileData.active === false) {
          router.replace("/login");
          return;
        }

        if (!alive) return;
        setProfile(profileData as Profile);

        if (!templateId) {
          setError("Falta el template de auditoría.");
          setLoading(false);
          return;
        }

        const hotelIdToUse =
          (profileData as any)?.hotel_id ?? (await fetchActiveHotel()).hotel_id ?? null;

        if (!hotelIdToUse) {
          throw new Error("No hay hotel seleccionado.");
        }

        // 1) Intentamos resolver el área desde las asignaciones del usuario
        const { data: assignments, error: assignmentsErr } = await supabase
          .from("area_template_target_assignments")
          .select("id, hotel_id, area_id, audit_template_id, user_id, period, target_count, active")
          .eq("hotel_id", hotelIdToUse)
          .eq("user_id", user.id)
          .eq("audit_template_id", templateId)
          .eq("active", true);

        if (assignmentsErr) throw assignmentsErr;

        let resolvedAreaId: string | null =
          ((assignments ?? []) as AssignmentRow[])[0]?.area_id ?? null;

        // 2) Fallback para roles amplios: si no hay assignment del usuario,
        // intentamos resolver el área desde area_template_targets
        if (!resolvedAreaId) {
          const { data: targets, error: targetsErr } = await supabase
            .from("area_template_targets")
            .select("area_id")
            .eq("hotel_id", hotelIdToUse)
            .eq("audit_template_id", templateId)
            .eq("active", true)
            .limit(1);

          if (targetsErr) throw targetsErr;

          resolvedAreaId = (targets?.[0] as any)?.area_id ?? null;
        }

        if (!resolvedAreaId) {
          throw new Error(
            "No se pudo determinar el área para esta auditoría. Revisa las asignaciones del template."
          );
        }

        // 3) Cargamos info visual de template + área
        const [{ data: tData, error: tErr }, { data: aData, error: aErr }] =
          await Promise.all([
            supabase.from("audit_templates").select("id, name").eq("id", templateId).single(),
            supabase.from("areas").select("id, name, hotel_id, type").eq("id", resolvedAreaId).single(),
          ]);

        if (tErr || !tData) throw tErr ?? new Error("Template no encontrado.");
        if (aErr || !aData) throw aErr ?? new Error("Área no encontrada.");

        if (!alive) return;
        setTemplate(tData as TemplateRow);
        setArea(aData as AreaRow);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "No se pudo preparar la auditoría.");
        setLoading(false);
      }
    }

    void init();

    return () => {
      alive = false;
    };
  }, [router, templateId]);

  async function handleStart() {
    if (!profile || !templateId || !area) return;

    setStarting(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) throw userErr ?? new Error("No hay sesión activa.");

      const hotelIdToUse =
        (profile as any)?.hotel_id ?? area.hotel_id ?? (await fetchActiveHotel()).hotel_id ?? null;

      if (!hotelIdToUse) {
        throw new Error("No se pudo determinar el hotel para crear la auditoría.");
      }

      const nextRoomNumber = isHousekeepingArea(area) ? roomNumber.trim() || null : null;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesión inválida.");

      const response = await fetch("/api/audits/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          area_id: area.id,
          audit_template_id: templateId,
          room_number: nextRoomNumber,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.run_id) {
        throw new Error(payload?.error ?? "No se pudo crear la auditoría.");
      }

      router.replace(`/audits/${payload.run_id}`);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo iniciar la auditoría.");
      setStarting(false);
    }
  }

  if (loading) {
    return <p style={{ padding: 24 }}>Preparando auditoría…</p>;
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 18 }}>
        Nueva auditoría
      </h1>

      {error ? (
        <div
          style={{
            padding: 12,
            border: "1px solid rgba(255,0,0,0.35)",
            borderRadius: 10,
            marginBottom: 14,
          }}
        >
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: 12,
          maxWidth: 720,
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 16,
          padding: 16,
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Template</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
            {template?.name ?? "Auditoría"}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Área</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
            {area?.name ?? "—"}
          </div>
        </div>

        {isHousekeepingArea(area) ? (
          <div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Room number</div>
            <input
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="Ej. 1204A"
              style={{
                width: "100%",
                marginTop: 4,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "#fff",
                color: "#111",
                fontWeight: 600,
              }}
            />
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => router.back()}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "transparent",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Cancelar
          </button>

          <button
            onClick={handleStart}
            disabled={starting || !!error}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #000",
              background: "#000",
              color: "#fff",
              cursor: starting || !!error ? "not-allowed" : "pointer",
              fontWeight: 700,
              opacity: starting || !!error ? 0.6 : 1,
            }}
          >
            {starting ? "Iniciando…" : "Empezar auditoría"}
          </button>
        </div>
      </div>
    </main>
  );
}
