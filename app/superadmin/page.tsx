// app/superadmin/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";

type Card = {
  title: string;
  subtitle: string;
  href: string;
  icon: string;
};

export default function SuperadminHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const styles = useMemo(() => {
    const page: React.CSSProperties = { padding: 24, paddingTop: 24 };
    const headerWrap: React.CSSProperties = {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    };

    const title: React.CSSProperties = { fontSize: 40, fontWeight: 950, letterSpacing: -0.6 };
    const subtitle: React.CSSProperties = { opacity: 0.75, marginTop: 8 };

    const grid: React.CSSProperties = {
      marginTop: 22,
      display: "grid",
      gridTemplateColumns: "repeat(12, 1fr)",
      gap: 18,
    };

    const card: React.CSSProperties = {
      gridColumn: "span 6",
      background: "var(--card-bg)",
      border: "1px solid var(--header-border)",
      borderRadius: 18,
      boxShadow: "var(--shadow-sm)",
      padding: 18,
      cursor: "pointer",
      userSelect: "none",
      transition: "transform 120ms ease, box-shadow 120ms ease",
    };

    const cardTop: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 };
    const icon: React.CSSProperties = { fontSize: 18 };
    const cardTitle: React.CSSProperties = { fontSize: 18, fontWeight: 950 };
    const cardSub: React.CSSProperties = { opacity: 0.75, fontSize: 13, lineHeight: 1.35 };

    const hint: React.CSSProperties = {
      marginTop: 18,
      opacity: 0.7,
      fontSize: 12,
    };

    return { page, headerWrap, title, subtitle, grid, card, cardTop, icon, cardTitle, cardSub, hint };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await requireRoleOrRedirect(router, ["superadmin"], "/dashboard");
      if (!p) return;
      if (!alive) return;
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const cards: Card[] = [
    {
      title: "Biblioteca Global",
      subtitle: "Gestiona packs y plantillas base para todos los hoteles (catálogo global).",
      href: "/superadmin/global-audits",
      icon: "🌍",
    },
    {
      title: "Hoteles",
      subtitle: "Administración global de hoteles del sistema.",
      href: "/superadmin/hotels",
      icon: "🏨",
    },
  ];

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.headerWrap}>
        <div>
          <div style={styles.title}>Superadmin</div>
          <div style={styles.subtitle}>Gestión global del sistema ServiceControl</div>
        </div>
      </div>

      <div style={styles.grid}>
        {cards.map((c) => (
          <div
            key={c.href}
            style={styles.card}
            onClick={() => router.push(c.href)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(0px)";
            }}
          >
            <div style={styles.cardTop}>
              <span style={styles.icon}>{c.icon}</span>
              <div style={styles.cardTitle}>{c.title}</div>
            </div>
            <div style={styles.cardSub}>{c.subtitle}</div>
          </div>
        ))}
      </div>

      <div style={styles.hint}>
        Consejo: “Biblioteca Global” centraliza los packs y sus plantillas para reutilizarlos entre hoteles.
      </div>
    </main>
  );
}