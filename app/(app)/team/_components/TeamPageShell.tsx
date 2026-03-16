"use client";

import Card from "@/components/ui/Card";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import {
  fetchDepartmentCorrectiveActions,
  getDepartmentCorrectiveActionsQueryKey,
} from "@/hooks/useDepartmentCorrectiveActions";

function buildBtnStyle(): CSSProperties {
  return {
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "9px 11px",
    background: "var(--card-bg)",
    color: "rgba(15,23,42,0.82)",
    cursor: "pointer",
    transition: "background 140ms ease, border-color 140ms ease, color 140ms ease, box-shadow 140ms ease",
  };
}

type TeamSectionKey = "general" | "progress" | "reaudits" | "history" | "actions";

export default function TeamPageShell({
  profile,
  profileError,
  activeSection,
  children,
  periodControl,
  areaLabel,
}: {
  profile: Profile | null;
  profileError: string | null;
  activeSection: TeamSectionKey;
  children: ReactNode;
  periodControl?: ReactNode;
  areaLabel?: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const btn = useMemo(() => buildBtnStyle(), []);

  useEffect(() => {
    router.prefetch("/it");
    router.prefetch("/engineering");
  }, [router]);

  useEffect(() => {
    if (!profile?.id) return;

    void queryClient.prefetchQuery({
      queryKey: getDepartmentCorrectiveActionsQueryKey(profile.id, "it"),
      queryFn: () => fetchDepartmentCorrectiveActions(profile.id, "it"),
      staleTime: 5 * 60 * 1000,
    });

    void queryClient.prefetchQuery({
      queryKey: getDepartmentCorrectiveActionsQueryKey(profile.id, "engineering"),
      queryFn: () => fetchDepartmentCorrectiveActions(profile.id, "engineering"),
      staleTime: 5 * 60 * 1000,
    });
  }, [profile?.id, queryClient]);

  const showSummaryTab =
    profile?.role === "superadmin" ||
    profile?.role === "admin" ||
    profile?.role === "manager" ||
    profile?.role === "quality";

  const showReauditsTab =
    profile?.role === "superadmin" ||
    profile?.role === "admin" ||
    profile?.role === "manager" ||
    profile?.role === "quality";

  const showManagerAreaTabs = profile?.role === "manager";
  const showMembersLink =
    profile?.role === "superadmin" ||
    profile?.role === "admin" ||
    profile?.role === "general_manager" ||
    profile?.role === "manager" ||
    profile?.role === "quality";
  const showDepartmentNav =
    profile?.role === "superadmin" ||
    profile?.role === "admin" ||
    profile?.role === "general_manager" ||
    profile?.role === "manager" ||
    profile?.role === "quality";

  const tabStyle = (isActive: boolean): CSSProperties => ({
    ...btn,
    background: isActive ? "#dbeafe" : "var(--card-bg)",
    color: isActive ? "#1e3a8a" : "rgba(15,23,42,0.82)",
    border: isActive ? "1px solid #bfdbfe" : "1px solid var(--border)",
    boxShadow: isActive ? "0 0 0 1px rgba(59,130,246,0.08)" : "none",
    fontWeight: isActive ? 800 : 600,
  });

  return (
    <div style={{ padding: "12px 14px 18px", width: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>Equipo</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            Hola, <b>{profile?.full_name ?? "—"}</b> · Rol: <b>{profile?.role ?? "—"}</b>
          </div>
          {areaLabel ? (
            <div style={{ opacity: 0.78, marginTop: 4, fontSize: 13, fontWeight: 700 }}>
              {areaLabel}
            </div>
          ) : null}
          <div style={{ opacity: 0.65, marginTop: 4, fontSize: 12 }}>
            Panel operativo del equipo, acciones correctivas y seguimiento de objetivos.
          </div>
        </div>

        {periodControl ? (
          <div style={{ minWidth: 180, flex: "1 1 180px", maxWidth: 240 }}>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Periodo global</div>
            {periodControl}
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {showManagerAreaTabs ? (
          <button style={tabStyle(activeSection === "general")} onClick={() => router.push("/team/general")}>
            General
          </button>
        ) : null}

        {showSummaryTab ? (
          <button style={tabStyle(activeSection === "progress")} onClick={() => router.push("/team/progreso")}>
            Progreso
          </button>
        ) : null}

        {showReauditsTab ? (
          <button style={tabStyle(activeSection === "reaudits")} onClick={() => router.push("/team/recuperacion")}>
            Recuperación
          </button>
        ) : null}

        {showManagerAreaTabs ? (
          <button style={tabStyle(activeSection === "history")} onClick={() => router.push("/team/historial")}>
            Historial
          </button>
        ) : null}

        <button style={tabStyle(activeSection === "actions")} onClick={() => router.push("/formaciones")}>
          Formaciones
        </button>

        <button style={tabStyle(false)} onClick={() => router.push("/analytics")}>
          Analisis
        </button>

        {showMembersLink ? (
          <button style={tabStyle(false)} onClick={() => router.push("/members")}>
            Members
          </button>
        ) : null}

        {showDepartmentNav ? (
          <Link href="/it" prefetch style={tabStyle(false)}>
            IT
          </Link>
        ) : null}

        {showDepartmentNav ? (
          <Link href="/engineering" prefetch style={tabStyle(false)}>
            Engineering
          </Link>
        ) : null}
      </div>

      {profileError ? (
        <Card style={{ marginTop: 14, border: "1px solid rgba(255,0,0,0.25)" }}>
          <b>Error:</b> {profileError}
        </Card>
      ) : null}

      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}
