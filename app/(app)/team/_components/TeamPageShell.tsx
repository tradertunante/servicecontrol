"use client";

import Card from "@/components/ui/Card";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--card-bg)",
    color: "rgba(15,23,42,0.82)",
    cursor: "pointer",
    transition: "background 140ms ease, border-color 140ms ease, color 140ms ease, box-shadow 140ms ease",
  };
}

type TeamSectionKey = "general" | "progress" | "reaudits" | "history" | "actions";

type TeamNavItem = {
  key: string;
  label: string;
  href: string;
  active: boolean;
  visible: boolean;
};

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
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const t = useTranslations("app.team.shell");

  const currentAreaId = searchParams.get("area") ?? "";
  const btn = useMemo(() => buildBtnStyle(), []);

  // Pack access — superadmin resuelto síncronamente, otros esperan el fetch
  const [enabledPacks, setEnabledPacks] = useState<string[] | null>(
    profile?.role === "superadmin" ? ["base", "pack1", "pack2", "pack_it", "pack_engineering", "pack3"] : null
  );

  useEffect(() => {
    if (profile?.role === "superadmin") return;
    let alive = true;
    fetch("/api/hotel/packs", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { packs?: string[] }) => {
        if (alive && Array.isArray(data.packs)) setEnabledPacks(data.packs);
      })
      .catch(() => {
        // En caso de error mostramos solo base
        if (alive) setEnabledPacks(["base"]);
      });
    return () => { alive = false; };
  }, [profile?.role]);

  useEffect(() => {
    router.prefetch("/it");
    router.prefetch("/engineering");
    router.prefetch("/otros");
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

    void queryClient.prefetchQuery({
      queryKey: getDepartmentCorrectiveActionsQueryKey(profile.id, "otros"),
      queryFn: () => fetchDepartmentCorrectiveActions(profile.id, "otros"),
      staleTime: 5 * 60 * 1000,
    });
  }, [profile?.id, queryClient]);

  const canSeeAreaWorkspace =
    profile?.role === "superadmin" ||
    profile?.role === "admin" ||
    profile?.role === "general_manager" ||
    profile?.role === "manager" ||
    profile?.role === "quality";
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
  const showSummaryTab = canSeeAreaWorkspace;
  const showReauditsTab = canSeeAreaWorkspace;

  const navItems: TeamNavItem[] = [
    {
      key: "general",
      label: t("nav.general"),
      href: "/team/general",
      active: activeSection === "general",
      visible: canSeeAreaWorkspace,
    },
    {
      key: "progress",
      label: t("nav.progress"),
      href: "/team/progreso",
      active: activeSection === "progress",
      visible: showSummaryTab,
    },
    {
      key: "reaudits",
      label: t("nav.reaudits"),
      href: "/team/recuperacion",
      active: activeSection === "reaudits",
      visible: showReauditsTab && enabledPacks?.includes("pack2") === true,
    },
    {
      key: "history",
      label: t("nav.history"),
      href: "/team/historial",
      active: activeSection === "history",
      visible: canSeeAreaWorkspace,
    },
    {
      key: "actions",
      label: t("nav.actions"),
      href: "/formaciones",
      active: activeSection === "actions",
      visible: enabledPacks?.includes("pack3") === true,
    },
    {
      key: "analytics",
      label: t("nav.analytics"),
      href: "/analytics",
      active: false,
      visible: enabledPacks?.includes("pack1") === true,
    },
    {
      key: "members",
      label: t("nav.members"),
      href: "/members",
      active: false,
      visible: !!showMembersLink,
    },
    {
      key: "it",
      label: t("nav.it"),
      href: "/it",
      active: false,
      visible: !!showDepartmentNav && enabledPacks?.includes("pack_it") === true,
    },
    {
      key: "engineering",
      label: t("nav.engineering"),
      href: "/engineering",
      active: false,
      visible: !!showDepartmentNav && enabledPacks?.includes("pack_engineering") === true,
    },
    {
      key: "otros",
      label: t("nav.otros"),
      href: "/otros",
      active: false,
      visible: !!showDepartmentNav,
    },
  ];

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
        data-onboarding="team-header"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>{t("title")}</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            {t("hello")} <b>{profile?.full_name ?? "—"}</b> · {t("role")} <b>{profile?.role ?? "—"}</b>
          </div>
          {areaLabel ? (
            <div style={{ opacity: 0.78, marginTop: 4, fontSize: 13, fontWeight: 700 }}>
              {areaLabel}
            </div>
          ) : null}
          <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>
            {t("subtitle")}
          </div>
        </div>

        {periodControl ? (
          <div style={{ minWidth: 180, flex: "1 1 180px", maxWidth: 240 }}>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>{t("globalPeriod")}</div>
            {periodControl}
          </div>
        ) : null}
      </div>

      <div
        data-onboarding="team-nav"
        className="teamNav"
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {navItems
          .filter((item) => item.visible)
          .map((item) =>
            item.href === "/it" || item.href === "/engineering" || item.href === "/otros" ? (
              <Link key={item.key} href={item.href} prefetch style={tabStyle(item.active)}>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.key}
                style={tabStyle(item.active)}
                onClick={() => {
                  let href = item.href;
                  if (currentAreaId) {
                    if (item.href.startsWith("/team/")) {
                      href = `${item.href}?area=${currentAreaId}`;
                    } else if (item.href === "/analytics") {
                      href = `/analytics?areaId=${currentAreaId}`;
                    }
                  }
                  router.push(href);
                }}
              >
                {item.label}
              </button>
            )
          )}
      </div>
      <style jsx>{`
        @media (max-width: 720px) {
          .teamNav {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 6px !important;
          }
          .teamNav > * {
            width: 100%;
            box-sizing: border-box;
            text-align: center;
          }
        }
      `}</style>

      {profileError ? (
        <Card style={{ marginTop: 14, border: "1px solid rgba(255,0,0,0.25)" }}>
          <b>Error:</b> {profileError}
        </Card>
      ) : null}

      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}
