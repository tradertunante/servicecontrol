"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import {
  normalizeRole,
  canManageAreas,
  canManageUsers,
  canEditTemplates,
  canRunAudits,
  type Role,
} from "@/lib/auth/permissions";

type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  hotel_id: string | null;
};

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (!alive) return;

      if (authErr || !authData?.user) {
        router.push("/login");
        return;
      }

      setEmail(authData.user.email ?? "");

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, role, hotel_id")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (!alive) return;

      if (profErr || !prof) {
        setError("No se pudo cargar el perfil.");
        setLoading(false);
        return;
      }

      const role = normalizeRole(prof.role);

      setProfile({
        id: prof.id,
        full_name: prof.full_name ?? null,
        role,
        hotel_id: prof.hotel_id ?? null,
      });

      setLoading(false);
    }

    load();

    return () => {
      alive = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>ServiceControl</h1>
        <p style={{ opacity: 0.7, marginTop: 8 }}>Cargando...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>ServiceControl</h1>
        <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>
      </main>
    );
  }

  const role = profile?.role ?? "auditor";

  const cards = [
    {
      title: "Áreas",
      desc: canManageAreas(role)
        ? "Crear/editar áreas del hotel."
        : "Ver áreas disponibles para auditorías.",
      href: "/areas",
      show: true,
      disabledNote: "",
    },
    {
      title: "Usuarios",
      desc: "Gestionar usuarios del hotel (solo admin).",
      href: "/users",
      show: canManageUsers(role),
      disabledNote: "No disponible para tu rol.",
    },
    {
      title: "Plantillas",
      desc: "Gestionar plantillas de auditoría (admin/manager).",
      href: "/templates",
      show: canEditTemplates(role),
      disabledNote: "No disponible para auditor.",
    },
    {
      title: "Auditorías",
      desc: "Iniciar y continuar auditorías.",
      href: "/areas",
      show: canRunAudits(role),
      disabledNote: "",
    },
  ].filter((c) => c.show);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 6 }}>
        ServiceControl
      </h1>

      <p style={{ opacity: 0.75, marginBottom: 18 }}>
        Usuario: {email} · Rol: <b>{role}</b>
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
          maxWidth: 980,
        }}
      >
        {cards.map((c) => (
          <button
            key={c.title}
            onClick={() => router.push(c.href)}
            style={{
              textAlign: "left",
              padding: 18,
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "#fff",
              boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>{c.title}</div>
            <div style={{ marginTop: 6, opacity: 0.75, fontSize: 14 }}>
              {c.desc}
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}

