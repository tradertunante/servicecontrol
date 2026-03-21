"use client";

import { createContext, useContext } from "react";
import type { useAuditSession } from "../_hooks/useAuditSession";
import type { useAuditNavigation } from "../_hooks/useAuditNavigation";

type SessionReturn = ReturnType<typeof useAuditSession>;
type NavigationReturn = ReturnType<typeof useAuditNavigation>;

/**
 * The context value is the full return of useAuditSession merged with
 * the navigation fields from useAuditNavigation (renamed to match the
 * original AuditPageShell prop names).
 */
export type AuditSessionContextValue = SessionReturn & {
  activeQuestionId: NavigationReturn["activeQuestionId"];
  activeSectionId: NavigationReturn["activeSectionId"];
  canGoPrevious: NavigationReturn["hasPrevious"];
  canGoNext: NavigationReturn["hasNext"];
  onSelectSection: NavigationReturn["goToSection"];
  onPreviousQuestion: NavigationReturn["goToPreviousQuestion"];
  onNextQuestion: NavigationReturn["goToNextQuestion"];
};

const AuditSessionContext = createContext<AuditSessionContextValue | null>(null);

export function AuditSessionProvider({
  value,
  children,
}: {
  value: AuditSessionContextValue;
  children: React.ReactNode;
}) {
  return (
    <AuditSessionContext.Provider value={value}>
      {children}
    </AuditSessionContext.Provider>
  );
}

export function useAuditSessionContext(): AuditSessionContextValue {
  const ctx = useContext(AuditSessionContext);
  if (!ctx) {
    throw new Error("useAuditSessionContext must be used within AuditSessionProvider");
  }
  return ctx;
}
