"use client";

import { useParams } from "next/navigation";
import AuditPageShell from "./_components/AuditPageShell";
import { AuditSessionProvider } from "./_context/AuditSessionContext";
import { useAuditNavigation } from "./_hooks/useAuditNavigation";
import { useAuditSession } from "./_hooks/useAuditSession";

export default function AuditRunPage() {
  const params = useParams<{ id: string }>();
  const runId = params?.id;

  const session = useAuditSession(runId);
  const navigation = useAuditNavigation({
    sections: session.sections,
    questions: session.questions,
  });

  if (session.loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <p className="text-sm font-semibold text-slate-600">Cargando auditoría…</p>
      </main>
    );
  }

  if (!session.run) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <p className="text-sm font-semibold text-rose-600">
          {session.error ?? "Auditoría no disponible."}
        </p>
      </main>
    );
  }

  const sessionWithNavigation = {
    ...session,
    activeQuestionId: navigation.activeQuestionId,
    activeSectionId: navigation.activeSectionId,
    canGoPrevious: navigation.hasPrevious,
    canGoNext: navigation.hasNext,
    onSelectSection: navigation.goToSection,
    onPreviousQuestion: navigation.goToPreviousQuestion,
    onNextQuestion: navigation.goToNextQuestion,
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <AuditSessionProvider value={sessionWithNavigation}>
        <AuditPageShell />
      </AuditSessionProvider>
    </main>
  );
}
