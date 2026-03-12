"use client";

import Card from "@/components/ui/Card";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import type { Profile } from "@/lib/types";
import type { TeamPeriodKey } from "./_hooks/useTeamData";
import CorrectiveActionsPanel from "./_components/CorrectiveActionsPanel";
import ReauditsPanel from "./_components/ReauditsPanel";
import TeamSummaryTab from "./_components/TeamSummaryTab";
import ManagerAreaWorkspace, {
  type ManagerAreaHistoryFilters,
  type ManagerAreaOption,
} from "./_components/ManagerAreaWorkspace";

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

function buildInputStyle(): CSSProperties {
  return {
    width: "100%",
    padding: "9px 11px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.18)",
    color: "white",
    outline: "none",
  };
}

const HOTEL_KEY = "sc_hotel_id";

type TeamTabKey = "summary" | "actions" | "reaudits" | "area" | "history" | "templates";

export default function TeamPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  requireRoleOrRedirect(
    ["superadmin", "admin", "manager", "quality", "engineering", "systems"],
    router
  );

  const btn = useMemo(() => buildBtnStyle(), []);
  const input = useMemo(() => buildInputStyle(), []);

  const [selectedPeriod, setSelectedPeriod] = useState<TeamPeriodKey>("monthly");
  const [activeTab, setActiveTab] = useState<TeamTabKey>("area");
  const [hoveredTab, setHoveredTab] = useState<TeamTabKey | null>(null);
  const [managerAreasLoading, setManagerAreasLoading] = useState(false);
  const [managerAreasError, setManagerAreasError] = useState<string | null>(null);
  const [managerAreaOptions, setManagerAreaOptions] = useState<ManagerAreaOption[]>([]);
  const [selectedManagerAreaId, setSelectedManagerAreaId] = useState("");
  const [managerAreaHistoryFilters, setManagerAreaHistoryFilters] =
    useState<ManagerAreaHistoryFilters>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setProfileError(null);

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const uid = authData.user?.id;
        if (!uid) throw new Error("No hay usuario autenticado.");

        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("id, full_name, role, hotel_id, active")
          .eq("id", uid)
          .single();

        if (pErr) throw pErr;
        if (!cancelled) setProfile(p as Profile);
      } catch (e: any) {
        if (!cancelled) setProfileError(e?.message ?? "No se pudo cargar el perfil.");
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (!requestedTab) return;

    const allowedTabs: TeamTabKey[] = [
      "summary",
      "actions",
      "reaudits",
      "area",
      "history",
      "templates",
    ];

    if (!allowedTabs.includes(requestedTab as TeamTabKey)) return;

    if (profile?.role === "manager") {
      setActiveTab(requestedTab as TeamTabKey);
      return;
    }

    if (requestedTab === "summary" || requestedTab === "actions" || requestedTab === "reaudits") {
      setActiveTab(requestedTab);
    }
  }, [profile?.role, searchParams]);

  useEffect(() => {
    if (profile?.role === "engineering" || profile?.role === "systems") {
      setActiveTab("actions");
      return;
    }

    if (profile?.role === "manager") {
      setActiveTab((prev) => {
        if (
          prev === "summary" ||
          prev === "actions" ||
          prev === "reaudits" ||
          prev === "area" ||
          prev === "history" ||
          prev === "templates"
        ) {
          return prev;
        }
        return "area";
      });
      return;
    }

    setActiveTab((prev) => {
      if (prev === "summary" || prev === "actions" || prev === "reaudits") {
        return prev;
      }
      return "summary";
    });
  }, [profile?.role]);

  useEffect(() => {
    let cancelled = false;

    async function loadManagerAreas() {
      if (profile?.role !== "manager") {
        setManagerAreaOptions([]);
        setSelectedManagerAreaId("");
        setManagerAreasError(null);
        setManagerAreasLoading(false);
        return;
      }

      try {
        setManagerAreasLoading(true);
        setManagerAreasError(null);

        const hotelIdToUse =
          profile.hotel_id ??
          (typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null) ??
          "";

        const { data: accessData, error: accessError } = await supabase
          .from("user_area_access")
          .select("area_id")
          .eq("user_id", profile.id)
          .eq("hotel_id", hotelIdToUse);

        if (accessError) throw accessError;

        const areaIds = Array.from(
          new Set((accessData ?? []).map((row: { area_id: string | null }) => row.area_id).filter(Boolean))
        ) as string[];

        if (areaIds.length === 0) {
          if (cancelled) return;
          setManagerAreaOptions([]);
          setSelectedManagerAreaId("");
          setManagerAreasLoading(false);
          return;
        }

        const { data: areaData, error: areaError } = await supabase
          .from("areas")
          .select("id,name,type")
          .in("id", areaIds)
          .order("name", { ascending: true });

        if (areaError) throw areaError;

        const options = (areaData ?? []) as ManagerAreaOption[];
        if (cancelled) return;

        setManagerAreaOptions(options);
        setSelectedManagerAreaId((prev) =>
          prev && options.some((area) => area.id === prev) ? prev : options[0]?.id ?? ""
        );
      } catch (error: any) {
        if (cancelled) return;
        setManagerAreasError(error?.message ?? "No se pudieron cargar las áreas asignadas.");
      } finally {
        if (!cancelled) setManagerAreasLoading(false);
      }
    }

    void loadManagerAreas();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const hotelId =
    typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) ?? "" : "";

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
  const activeManagerArea =
    showManagerAreaTabs && selectedManagerAreaId
      ? managerAreaOptions.find((area) => area.id === selectedManagerAreaId) ?? null
      : null;
  const showManagerAreaLabel =
    Boolean(activeManagerArea) &&
    (activeTab === "area" || activeTab === "history" || activeTab === "templates");

  const tabStyle = (tabKey: TeamTabKey, isActive: boolean): CSSProperties => ({
    ...btn,
    background: isActive ? "#dbeafe" : hoveredTab === tabKey ? "#f3f4f6" : "var(--card-bg)",
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
          {showManagerAreaLabel ? (
            <div style={{ opacity: 0.78, marginTop: 4, fontSize: 13, fontWeight: 700 }}>
              {activeManagerArea?.name ?? "—"}
              {activeManagerArea?.type ? ` · ${activeManagerArea.type}` : ""}
            </div>
          ) : null}
          <div style={{ opacity: 0.65, marginTop: 4, fontSize: 12 }}>
            Panel operativo del equipo, acciones correctivas y seguimiento de objetivos.
          </div>
        </div>

        {showSummaryTab && activeTab === "summary" ? (
          <div style={{ minWidth: 180, flex: "1 1 180px", maxWidth: 240 }}>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Periodo global</div>
            <select
              style={input}
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as TeamPeriodKey)}
            >
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select>
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
          <button
            style={tabStyle("area", activeTab === "area")}
            onClick={() => setActiveTab("area")}
            onMouseEnter={() => setHoveredTab("area")}
            onMouseLeave={() => setHoveredTab((prev) => (prev === "area" ? null : prev))}
          >
            General
          </button>
        ) : null}

        {showSummaryTab ? (
          <button
            style={tabStyle("summary", activeTab === "summary")}
            onClick={() => setActiveTab("summary")}
            onMouseEnter={() => setHoveredTab("summary")}
            onMouseLeave={() => setHoveredTab((prev) => (prev === "summary" ? null : prev))}
          >
            Follow up
          </button>
        ) : null}

        {showReauditsTab ? (
          <button
            style={tabStyle("reaudits", activeTab === "reaudits")}
            onClick={() => setActiveTab("reaudits")}
            onMouseEnter={() => setHoveredTab("reaudits")}
            onMouseLeave={() => setHoveredTab((prev) => (prev === "reaudits" ? null : prev))}
          >
            Recuperación
          </button>
        ) : null}

        {showManagerAreaTabs ? (
          <button
            style={tabStyle("history", activeTab === "history")}
            onClick={() => setActiveTab("history")}
            onMouseEnter={() => setHoveredTab("history")}
            onMouseLeave={() => setHoveredTab((prev) => (prev === "history" ? null : prev))}
          >
            Historial
          </button>
        ) : null}

        <button
          style={tabStyle("actions", activeTab === "actions")}
          onClick={() => setActiveTab("actions")}
          onMouseEnter={() => setHoveredTab("actions")}
          onMouseLeave={() => setHoveredTab((prev) => (prev === "actions" ? null : prev))}
        >
          Corrective actions
        </button>
      </div>

      {profileError ? (
        <Card style={{ marginTop: 14, border: "1px solid rgba(255,0,0,0.25)" }}>
          <b>Error:</b> {profileError}
        </Card>
      ) : null}

      {activeTab === "actions" ? (
        <div style={{ marginTop: 12 }}>
          <CorrectiveActionsPanel profile={profile} hotelId={hotelId} />
        </div>
      ) : null}

      {activeTab === "reaudits" && showReauditsTab ? (
        <div style={{ marginTop: 12 }}>
          <ReauditsPanel profile={profile} hotelId={hotelId} />
        </div>
      ) : null}

      {activeTab === "area" && showManagerAreaTabs ? (
        <div style={{ marginTop: 12 }}>
          <ManagerAreaWorkspace
            mode="dashboard"
            profileRole={profile?.role}
            areasLoading={managerAreasLoading}
            areasError={managerAreasError}
            areaOptions={managerAreaOptions}
            selectedAreaId={selectedManagerAreaId}
            onSelectArea={(areaId) => {
              setSelectedManagerAreaId(areaId);
              setManagerAreaHistoryFilters(null);
            }}
            historyFilters={managerAreaHistoryFilters}
            onOpenHistory={(filters) => {
              setManagerAreaHistoryFilters(filters);
              setActiveTab("history");
            }}
          />
        </div>
      ) : null}

      {activeTab === "history" && showManagerAreaTabs ? (
        <div style={{ marginTop: 12 }}>
          <ManagerAreaWorkspace
            mode="history"
            profileRole={profile?.role}
            areasLoading={managerAreasLoading}
            areasError={managerAreasError}
            areaOptions={managerAreaOptions}
            selectedAreaId={selectedManagerAreaId}
            onSelectArea={(areaId) => {
              setSelectedManagerAreaId(areaId);
              setManagerAreaHistoryFilters(null);
            }}
            historyFilters={managerAreaHistoryFilters}
            onOpenHistory={(filters) => setManagerAreaHistoryFilters(filters)}
          />
        </div>
      ) : null}

      {activeTab === "templates" && showManagerAreaTabs ? (
        <div style={{ marginTop: 12 }}>
          <ManagerAreaWorkspace
            mode="templates"
            profileRole={profile?.role}
            areasLoading={managerAreasLoading}
            areasError={managerAreasError}
            areaOptions={managerAreaOptions}
            selectedAreaId={selectedManagerAreaId}
            onSelectArea={(areaId) => {
              setSelectedManagerAreaId(areaId);
              setManagerAreaHistoryFilters(null);
            }}
            historyFilters={managerAreaHistoryFilters}
            onOpenHistory={(filters) => setManagerAreaHistoryFilters(filters)}
          />
        </div>
      ) : null}

      {activeTab === "summary" && showSummaryTab ? (
        <TeamSummaryTab selectedPeriod={selectedPeriod} hotelId={hotelId} />
      ) : null}
    </div>
  );
}
