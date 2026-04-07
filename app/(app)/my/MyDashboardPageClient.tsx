"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/providers/ToastProvider";

import { signOutAndRedirect } from "@/lib/auth";
import type { Profile } from "@/lib/types";

import { useMyDashboardData } from "./_hooks/useMyDashboardData";
import { useMyView } from "./_hooks/useMyView";
import MyHeader from "./_components/MyHeader";
import MySubnav from "./_components/MySubnav";
import MySummaryView from "./_components/MySummaryView";
import MyPlanView from "./_components/MyPlanView";
import MyPerformanceView from "./_components/MyPerformanceView";
import MyAccountView from "./_components/MyAccountView";

export default function MyDashboardPageClient({
  initialProfile,
  initialHotelId,
  initialHotelName,
}: {
  initialProfile: Profile;
  initialHotelId: string;
  initialHotelName: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { selectedPeriod, setSelectedPeriod, viewMode, setViewMode } = useMyView();

  const {
    loading,
    error,
    profile,
    hotelName: hotelNameFromClient,
    areaNames,
    myTargets,
    myRecentRuns,
    summary,
  } = useMyDashboardData({
    selectedPeriod,
    initialProfile: {
      id: initialProfile.id,
      full_name: initialProfile.full_name ?? null,
      role: initialProfile.role,
      hotel_id: initialProfile.hotel_id,
      active: initialProfile.active ?? null,
      email: null,
    },
    initialHotelId,
    enabled: !isLoggingOut,
  });

  const hotelName = hotelNameFromClient ?? initialHotelName;

  async function logout() {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    await signOutAndRedirect(router);
  }

  async function handleAudit() {
    try {
      if (profile?.role === "manager") {
        router.push("/team");
        return;
      }

      // Roles with full area access go straight to the templates selector
      const fullAccessRoles = ["admin", "general_manager", "superadmin", "quality"];
      if (fullAccessRoles.includes(profile?.role ?? "")) {
        router.push("/team/templates");
        return;
      }

      const res = await fetch("/api/my/area-access");
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Error de red.");

      const areaIds: string[] = payload?.areaIds ?? [];

      if (areaIds.length === 0) {
        toast.warn("No tienes ningún área asignada. Pide al administrador que te asigne un área.");
        router.push("/areas");
        return;
      }

      if (areaIds.length === 1) {
        router.push(`/areas/${areaIds[0]}?tab=templates`);
        return;
      }

      router.push("/areas");
    } catch (error) {
      console.error("Error resolving audit area access:", error);
      toast.error("No se pudo abrir el área de auditoría.");
    }
  }

  return (
    <div style={{ width: "100%", padding: "12px 14px 18px" }}>
      <MyHeader
        profile={profile}
        hotelName={hotelName}
        selectedPeriod={selectedPeriod}
        onChangePeriod={setSelectedPeriod}
        onAudit={handleAudit}
        onLogout={logout}
        isLoggingOut={isLoggingOut}
      />

      <MySubnav viewMode={viewMode} onChange={setViewMode} />

      {error ? (
        <div
          style={{
            border: "1px solid rgba(255,0,0,0.25)",
            borderRadius: 14,
            padding: 14,
            background: "rgba(255,0,0,0.06)",
            marginBottom: 14,
          }}
        >
          <b>Error:</b> {error}
        </div>
      ) : null}

      {viewMode === "summary" && (
        <MySummaryView
          loading={loading}
          selectedPeriod={selectedPeriod}
          summary={summary}
          myTargets={myTargets}
          myRecentRuns={myRecentRuns}
          onOpenPlan={() => setViewMode("plan")}
        />
      )}

      {viewMode === "plan" && (
        <MyPlanView
          loading={loading}
          myTargets={myTargets}
          onAuditTemplate={(templateId) =>
            router.push(`/audits/new?template=${encodeURIComponent(templateId)}`)
          }
        />
      )}

      {viewMode === "performance" && (
        <MyPerformanceView loading={loading} summary={summary} myTargets={myTargets} />
      )}

      {viewMode === "account" && (
        <MyAccountView
          loading={loading}
          profile={profile}
          hotelName={hotelName}
          areaNames={areaNames}
          myRecentRuns={myRecentRuns}
        />
      )}
    </div>
  );
}
