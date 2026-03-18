// app/superadmin/page.tsx
"use client";

import { useMemo, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

type Card = {
  title: string;
  subtitle: string;
  href: string;
  icon: string;
};

export default function SuperadminHomePage() {
  const router = useRouter();

  const styles = useMemo(() => {
    const page: CSSProperties = { padding: 24, paddingTop: 24 };
    const headerWrap: CSSProperties = {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    };

    const title: CSSProperties = { fontSize: 40, fontWeight: 950, letterSpacing: -0.6 };
    const subtitle: CSSProperties = { opacity: 0.75, marginTop: 8 };

    const grid: CSSProperties = {
      marginTop: 22,
      display: "grid",
      gridTemplateColumns: "repeat(12, 1fr)",
      gap: 18,
    };

    const card: CSSProperties = {
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

    const cardTop: CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 };
    const icon: CSSProperties = { fontSize: 18 };
    const cardTitle: CSSProperties = { fontSize: 18, fontWeight: 950 };
    const cardSub: CSSProperties = { opacity: 0.75, fontSize: 13, lineHeight: 1.35 };

    const hint: CSSProperties = {
      marginTop: 18,
      opacity: 0.7,
      fontSize: 12,
    };

    return { page, headerWrap, title, subtitle, grid, card, cardTop, icon, cardTitle, cardSub, hint };
  }, []);

  const cards: Card[] = [
    {
      title: "Importar históricos",
      subtitle: "Herramienta interna para cargar auditorías históricas por hotel y template.",
      href: "/superadmin/historical-import",
      icon: "📥",
    },
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
        Consejo: “Importar históricos” usa Excel estructurado por hotel y template; “Biblioteca Global” sigue siendo el catálogo base.
      </div>
    </main>
  );
}
