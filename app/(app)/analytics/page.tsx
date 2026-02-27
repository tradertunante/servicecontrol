// FILE: app/(app)/analytics/page.tsx
"use client";

import { useMemo, useState } from "react";
import BackButton from "@/app/components/BackButton";

import type { Period, TabKey } from "./_lib/analyticsTypes";
import { isoDaysAgo, periodLabel } from "./_lib/analyticsUtils";

import AnalyticsHeader from "./_components/AnalyticsHeader";
import AnalyticsFilters from "./_components/AnalyticsFilters";
import AnalyticsTabs from "./_components/AnalyticsTabs";
import RankingPanel from "./_components/RankingPanel";
import CommonFailuresPanel from "./_components/CommonFailuresPanel";
import MemberPanel from "./_components/MemberPanel";

import { useAnalyticsBoot } from "./_hooks/useAnalyticsBoot";
import { useAnalyticsData } from "./_hooks/useAnalyticsData";
import { useMemberAnalytics } from "./_hooks/useMemberAnalytics";

export default function AnalyticsPage() {
  const boot = useAnalyticsBoot();

  const [period, setPeriod] = useState<Period>("30");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const [tab, setTab] = useState<TabKey>("ranking");

  const [rankingMode, setRankingMode] = useState<string>("all");

  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [memberAuditMode, setMemberAuditMode] = useState<string>("all");

  const fromISO = useMemo(() => {
    if (period === "30") return isoDaysAgo(30);
    if (period === "60") return isoDaysAgo(60);
    if (period === "90") return isoDaysAgo(90);
    if (period === "365") return isoDaysAgo(365);
    if (period === "custom") {
      if (!customFrom) return isoDaysAgo(30);
      return new Date(customFrom + "T00:00:00").toISOString();
    }
    return isoDaysAgo(30);
  }, [period, customFrom]);

  const toISO = useMemo(() => {
    if (period !== "custom") return new Date().toISOString();
    if (!customTo) return new Date().toISOString();
    return new Date(customTo + "T23:59:59").toISOString();
  }, [period, customTo]);

  const summary = `${boot.selectedAreaLabel} · ${periodLabel(period)}`;

  const data = useAnalyticsData({
    hotelId: boot.hotelId,
    selectedAreaId: boot.selectedAreaId,
    fromISO,
    toISO,
    rankingMode,
    onFirstMemberAutoSelect: (firstId) => {
      setSelectedMemberId((prev) => prev || firstId || "");
    },
  });

  const member = useMemberAnalytics({
    hotelId: boot.hotelId,
    selectedAreaId: boot.selectedAreaId,
    fromISO,
    toISO,
    selectedMemberId,
    memberAuditMode,
    templates: data.templates,
  });

  if (boot.loading) {
    return (
      <main className="w-full min-h-screen bg-gray-50 overflow-x-hidden">
        <div className="w-full px-4 pt-4 pb-24">
          <p className="text-sm font-semibold text-gray-600">Cargando…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="w-full px-4 pt-4 pb-24">
        <div className="mb-3">
          <BackButton fallback="/dashboard" />
        </div>

        <AnalyticsHeader hotelName={boot.hotel?.name ?? "Hotel"} busy={data.busy} />

        {boot.error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {boot.error}
          </div>
        ) : null}

        {data.error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {data.error}
          </div>
        ) : null}

        <AnalyticsFilters
          areas={boot.areas}
          selectedAreaId={boot.selectedAreaId}
          setSelectedAreaId={boot.setSelectedAreaId}
          period={period}
          setPeriod={setPeriod}
          customFrom={customFrom}
          setCustomFrom={setCustomFrom}
          customTo={customTo}
          setCustomTo={setCustomTo}
          summary={summary}
        />

        <AnalyticsTabs tab={tab} setTab={setTab} />

        {tab === "ranking" ? (
          <RankingPanel
            ranking={data.ranking}
            templates={data.templates}
            rankingMode={rankingMode}
            setRankingMode={setRankingMode}
            sortKey={data.sortKey}
            sortDir={data.sortDir}
            toggleSort={data.toggleSort}
          />
        ) : null}

        {tab === "common" ? (
          <CommonFailuresPanel
            summary={summary}
            commonByPeople={data.commonByPeople}
            commonByFails={data.commonByFails}
          />
        ) : null}

        {tab === "member" ? (
          <MemberPanel
            summary={summary}
            members={data.membersForArea}
            templates={data.templates}
            selectedMemberId={selectedMemberId}
            setSelectedMemberId={setSelectedMemberId}
            memberAuditMode={memberAuditMode}
            setMemberAuditMode={setMemberAuditMode}
            report={member.report}
            trend={member.trend}
            topStandards={member.topStandards}
          />
        ) : null}

        {boot.profile ? (
          <div className="mt-6 text-xs font-semibold text-gray-500">
            Sesión: <span className="font-mono">{boot.profile.id}</span> · Rol:{" "}
            <span className="font-extrabold">{boot.profile.role}</span> · Hotel:{" "}
            <span className="font-mono">{boot.hotelId ?? "null"}</span>
          </div>
        ) : null}
      </div>
    </main>
  );
}