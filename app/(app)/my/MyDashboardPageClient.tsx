"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/providers/ToastProvider";

import { signOutAndRedirect } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
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
}: {
  initialProfile: Profile;
  initialHotelId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { selectedPeriod, setSelectedPeriod, viewMode, setViewMode } = useMyView();

  const {
    loading,
    error,
    profile,
    hotelName,
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

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error("No se pudo identificar tu usuario para abrir el área de auditoría.");
        return;
      }

      const { data, error } = await supabase
        .from("user_area_access")
        .select("area_id")
        .eq("user_id", user.id)
        .eq("hotel_id", initialHotelId);

      if (error) throw error;

      const areaIds = Array.from(
        new Set(
          (data ?? [])
            .map((row: { area_id: string | null }) => row.area_id)
            .filter((areaId: string | null): areaId is string => !!areaId)
        )
      );

      if (areaIds.length === 0) {
        toast.warn("No tienes ningún área asignada para auditar.");
        return;
      }

      if (areaIds.length === 1) {
        router.push(`/areas/${areaIds[0]}?tab=dashboard`);
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
