"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import BackButton from "@/app/components/BackButton";

import type { AnalyticsPagePayload, Period, SortDir, SortKey } from "./_lib/analyticsTypes";
import { periodLabel } from "./_lib/analyticsUtils";
import AnalyticsHeader from "./_components/AnalyticsHeader";
import AnalyticsFilters from "./_components/AnalyticsFilters";
import AnalyticsTabs from "./_components/AnalyticsTabs";
import AreaPanel from "./_components/AreaPanel";
import RankingPanel from "./_components/RankingPanel";
import CommonFailuresPanel from "./_components/CommonFailuresPanel";
import MemberPanel from "./_components/MemberPanel";

export default function AnalyticsPageClient({ payload }: { payload: AnalyticsPagePayload }) {
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  const [busy, startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<SortKey>("fail_rate_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { filters } = payload;

  useEffect(() => {
    setSortKey("fail_rate_pct");
    setSortDir("desc");
  }, [filters.rankingMode, filters.selectedAreaId, filters.fromISO, filters.toISO]);

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(currentSearchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const next = params.toString();
    startTransition(() => {
      router.replace(next ? `${pathname}?${next}` : pathname);
    });
  }

  function setPeriod(nextPeriod: Period) {
    updateQuery({
      period: nextPeriod,
      from: nextPeriod === "custom" ? filters.customFrom : null,
      to: nextPeriod === "custom" ? filters.customTo : null,
    });
  }

  function toggleSort(nextKey: SortKey) {
    setSortKey((prevKey) => {
      if (prevKey !== nextKey) {
        setSortDir("desc");
        return nextKey;
      }

      setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
      return prevKey;
    });
  }

  const ranking = useMemo(() => {
    const arr = [...payload.ranking];
    const dirMul = sortDir === "asc" ? 1 : -1;

    const cmpStr = (a: string, b: string) =>
      a.localeCompare(b, "es-ES", { sensitivity: "base" }) * dirMul;

    const cmpNum = (a: number | null, b: number | null) => {
      const av = a ?? -Infinity;
      const bv = b ?? -Infinity;
      if (av === bv) return 0;
      return av > bv ? 1 * dirMul : -1 * dirMul;
    };

    const cmpDate = (a: string | null, b: string | null) => {
      const av = a ? new Date(a).getTime() : -Infinity;
      const bv = b ? new Date(b).getTime() : -Infinity;
      if (av === bv) return 0;
      return av > bv ? 1 * dirMul : -1 * dirMul;
    };

    arr.sort((x, y) => {
      if (sortKey === "name") return cmpStr(x.name ?? "", y.name ?? "");
      if (sortKey === "audits_count") return cmpNum(x.audits_count, y.audits_count);
      if (sortKey === "fail_rate_pct") return cmpNum(x.fail_rate_pct, y.fail_rate_pct);
      return cmpDate(x.last_audit_at, y.last_audit_at);
    });

    return arr;
  }, [payload.ranking, sortDir, sortKey]);

  const summary = `${filters.selectedAreaLabel} · ${periodLabel(filters.period)}`;

  return (
    <main className="w-full min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="w-full px-4 pt-4 pb-24">
        <div className="mb-3">
          <BackButton fallback="/dashboard" />
        </div>

        <AnalyticsHeader hotelName={payload.hotel?.name ?? "Hotel"} busy={busy} />

        {payload.bootError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {payload.bootError}
          </div>
        ) : null}

        {payload.dataError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {payload.dataError}
          </div>
        ) : null}

        <AnalyticsFilters
          areas={payload.areas}
          selectedAreaId={filters.selectedAreaId}
          setSelectedAreaId={(value) =>
            updateQuery({
              areaId: value,
              memberId: null,
            })
          }
          period={filters.period}
          setPeriod={setPeriod}
          customFrom={filters.customFrom}
          setCustomFrom={(value) => updateQuery({ from: value, period: "custom" })}
          customTo={filters.customTo}
          setCustomTo={(value) => updateQuery({ to: value, period: "custom" })}
          summary={summary}
        />

        <AnalyticsTabs tab={filters.tab} setTab={(value) => updateQuery({ tab: value })} />

        {filters.tab === "area" ? (
          <AreaPanel summary={payload.areaSummary} areaLabel={filters.selectedAreaLabel} />
        ) : null}

        {filters.tab === "ranking" ? (
          <RankingPanel
            ranking={ranking}
            templates={payload.templates}
            rankingMode={filters.rankingMode}
            setRankingMode={(value) => updateQuery({ rankingMode: value })}
            sortKey={sortKey}
            sortDir={sortDir}
            toggleSort={toggleSort}
          />
        ) : null}

        {filters.tab === "common" ? (
          <CommonFailuresPanel
            summary={summary}
            commonByPeople={payload.commonByPeople}
            commonByFails={payload.commonByFails}
          />
        ) : null}

        {filters.tab === "member" ? (
          <MemberPanel
            summary={summary}
            members={payload.membersForArea}
            templates={payload.templates}
            selectedMemberId={filters.selectedMemberId}
            setSelectedMemberId={(value) => updateQuery({ memberId: value })}
            memberAuditMode={filters.memberAuditMode}
            setMemberAuditMode={(value) => updateQuery({ memberAuditMode: value })}
            report={payload.memberReport}
            trend={payload.memberTrend}
            topStandards={payload.memberTopStandards}
          />
        ) : null}
      </div>
    </main>
  );
}
