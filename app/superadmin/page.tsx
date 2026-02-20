"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";

export default function SuperadminHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const styles = useMemo(() => {
    const page: React.CSSProperties = {
      padding: 24,
      paddingTop: 80,
    };

    const grid: React.CSSProperties = {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: 16,
      marginTop: 24,
    };

    const card: React.CSSProperties = {
      background: "var(--card-bg)",
      border: "1px solid var(--header-border)",
      borderRadius: 18,
      boxShadow: "var(--shadow-sm)",
      padding: 20,
      cursor: "pointer",
      transition: "all .15s ease",
    };

    const title: React.CSSProperties = {
      fontSize: 20,
      fontWeight: 950,
      marginBottom: 6,
    };

    const subtitle: React.CSSProperties = {
      fontSize: 13,
      opacity: 0.75,
    };

    return { page, grid, card, title, subtitle };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      const p = await requireRoleOrRedirect(router, ["superadmin"], "/dashboard");
      if (!p) return;

      if (alive) setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main style={styles.page}>
        <HotelHeader />
        <div style={{ opacity: 0.7 }}>Cargando…</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <HotelHeader />

      <div style={{ fontSize: 30, fontWeight: 950, letterSpacing: -0.5 }}>
        Superadmin
      </div>

      <div style={{ opacity: 0.75, marginTop: 6 }}>
        Gestión global del sistema ServiceControl
      </div>

      <div style={styles.grid}>
        <div
          style={styles.card}
          onClick={() => router.push("/superadmin/packs")}
        >
          <div style={styles.title}>📦 Packs Globales</div>
          <div style={styles.subtitle}>
            Crear y gestionar packs como Forbes 2025, Cristal, LHW…
          </div>
        </div>

        <div
          style={styles.card}
          onClick={() => router.push("/superadmin/global-audits")}
        >
          <div style={styles.title}>🌍 Plantillas Globales</div>
          <div style={styles.subtitle}>
            Gestión de plantillas base para todos los hoteles
          </div>
        </div>

        <div
          style={styles.card}
          onClick={() => router.push("/superadmin/hotels")}
        >
          <div style={styles.title}>🏨 Hoteles</div>
          <div style={styles.subtitle}>
            Administración global de hoteles del sistema
          </div>
        </div>
      </div>
    </main>
  );
}