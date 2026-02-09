"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { canRunAudits } from "../../../lib/auth/permissions";

type Role = "admin" | "manager" | "auditor";

type Profile = {
  id: string;
  hotel_id: string;
  role: Role;
  active: boolean;
  full_name?: string | null;
};

type Area = {
  id: string;
  name: string;
  type: string;
};

type AuditTemplate = {
  id: string;
  name: string;
  area_id: string;
  hotel_id: string;
  active: boolean;
};

export default function StartAuditPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // Acepta ambos: areaId / area_id, templateId / template_id
  const areaId = useMemo(() => sp.get("areaId") || sp.get("area_id") || "", [sp]);
  const templateId = useMemo(
    () => sp.get("templateId") || sp.get("template_id") || "",
    [sp]
  );

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [tpl, setTpl] = useState<AuditTemplate | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMsg(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, hotel_id, role, active, full_name")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData || profileData.active === false) {
        router.push("/login");
        return;
      }

      const p = profileData as Profile;
      setProfile(p);

      if (!areaId || !templateId) {
        setErrorMsg("Faltan parámetros (areaId / templateId)");
        setLoading(false);
        return;
      }

      // cargar área
      const { data: areaData } = await supabase
        .from("areas")
        .select("id, name, type")
        .eq("id", areaId)
        .single();

      if (areaData) setArea(areaData as Area);

      // cargar template
      const { data: tplData, error: tplError } = await supabase
        .from("audit_templates")
        .select("id, name, area_id, hotel_id, active")
        .eq("id", templateId)
        .single();

      if (tplError || !tplData) {
        setErrorMsg("No se pudo cargar la auditoría seleccionada.");
        setLoading(false);
        return;
      }

      // Validación: que el template sea de tu hotel y del área que estás abriendo
      const t = tplData as AuditTemplate;
      setTpl(t);

      if (t.hotel_id !== p.hotel_id || t.area_id !== areaId) {
        setErrorMsg("Esta auditoría no pertenece a tu hotel o a esta área.");
        setLoading(false);
        return;
      }

      // Permisos
      if (!canRunAudits(p.role)) {
        setErrorMsg("No tienes permisos para iniciar esta auditoría.");
        setLoading(false);
        return;
      }

      setLoading(false);
    };

    init();
  }, [router, areaId, templateId]);

  const handleStart = async () => {
    if (!profile || !areaId || !templateId) return;

    // Crea el audit_run
    const { data: runData, error: runError } = await supabase
      .from("audit_runs")
      .insert({
        hotel_id: profile.hotel_id,
        area_id: areaId,
        audit_template_id: templateId,
        executed_by: profile.id,
        status: "draft",
      })
      .select("id")
      .single();

    if (runError || !runData?.id) {
      console.error(runError);
      setErrorMsg("No se pudo iniciar la auditoría.");
      return;
    }

    // Te mando a la pantalla del run (si no existe aún, lo creamos después)
    router.push(`/audits/${runData.id}`);
  };

  if (loading) return <p style={{ padding: 24, fontFamily: "system-ui" }}>Cargando...</p>;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Iniciar auditoría</h1>

      <div style={{ marginTop: 10, opacity: 0.8 }}>
        <div>
          Área: <b>{area?.name ?? "-"}</b>
        </div>
        <div>
          Auditoría: <b>{tpl?.name ?? "-"}</b>
        </div>
      </div>

      {errorMsg ? (
        <p style={{ color: "crimson", marginTop: 14 }}>{errorMsg}</p>
      ) : null}

      <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #000",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Volver
        </button>

        <button
          onClick={handleStart}
          disabled={!!errorMsg}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #000",
            background: !!errorMsg ? "#777" : "#000",
            color: "#fff",
            cursor: !!errorMsg ? "not-allowed" : "pointer",
            fontWeight: 800,
          }}
        >
          Iniciar auditoría
        </button>
      </div>
    </main>
  );
}
