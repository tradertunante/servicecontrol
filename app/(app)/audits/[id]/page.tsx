"use client";

import { useParams } from "next/navigation";
import AuditPageShell from "./_components/AuditPageShell";
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

  return (
    <main className="min-h-screen bg-slate-50">
      <AuditPageShell
        run={session.run}
        template={session.template}
        area={session.area}
        sections={session.sections}
        groupedQuestions={session.groupedQuestions}
        answersByQ={session.answersByQ}
        teamMembers={session.teamMembers}
        selectedMember={session.selectedMember}
        roomNumber={session.roomNumber}
        savingRoomNumber={session.savingRoomNumber}
        isHousekeeping={session.isHousekeeping}
        requiresRoomNumber={session.requiresRoomNumber}
        requiresAuditedEmployee={session.requiresAuditedEmployee}
        showRoomNumberField={session.showRoomNumberField}
        saving={session.saving}
        uploading={session.uploading}
        submitting={session.submitting}
        savingMember={session.savingMember}
        submitted={session.submitted}
        error={session.error}
        activeQuestionId={navigation.activeQuestionId}
        activeSectionId={navigation.activeSectionId}
        canGoPrevious={navigation.hasPrevious}
        canGoNext={navigation.hasNext}
        onSelectSection={navigation.goToSection}
        onSelectMember={session.saveTeamMember}
        onChangeRoomNumber={session.setRoomNumber}
        onSaveRoomNumber={session.saveRoomNumber}
        onSelectAnswer={session.setAnswer}
        onChangeComment={session.setComment}
        onUploadPhoto={session.uploadPhoto}
        onDeletePhoto={session.deletePhoto}
        onPreviousQuestion={navigation.goToPreviousQuestion}
        onNextQuestion={navigation.goToNextQuestion}
        onSubmit={session.submitRun}
      />
    </main>
  );
}
