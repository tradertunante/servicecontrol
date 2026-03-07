"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import { useMyDashboardData } from "./_hooks/useMyDashboardData";
import { useMyView } from "./_hooks/useMyView";
import MyHeader from "./_components/MyHeader";
import MySubnav from "./_components/MySubnav";
import MySummaryView from "./_components/MySummaryView";
import MyPlanView from "./_components/MyPlanView";
import MyPerformanceView from "./_components/MyPerformanceView";
import MyAccountView from "./_components/MyAccountView";

export default function MyDashboardPage() {
  const router = useRouter();
  requireRoleOrRedirect(["superadmin", "admin", "manager", "quality", "auditor"], router);

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
  } = useMyDashboardData(selectedPeriod);

  async function logout() {
    await supabase.auth.signOut();
    localStorage.removeItem("sc_hotel_id");
    router.replace("/login");
  }

  return (
    <div style={{ width: "100%", padding: 18 }}>
      <MyHeader
        profile={profile}
        hotelName={hotelName}
        selectedPeriod={selectedPeriod}
        onChangePeriod={setSelectedPeriod}
        onAudit={() => router.push("/audits/new")}
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
          onLogout={logout}
        />
      )}
    </div>
  );
}