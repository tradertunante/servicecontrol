"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getErrorMessage,
  loadAuditSession,
} from "./useAuditSession.lib";
import {
  cacheSession,
  loadCachedSession,
  loadLocalAnswers,
} from "@/lib/offline/auditIdb";
import type {
  AnswerRow,
  AnswerValue,
  AreaRow,
  AuditRunRow,
  QuestionRow,
  SectionRow,
  TeamMemberLite,
  TemplateRow,
} from "./useAuditSession.types";

export function useAuditLoader(runId: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const [run, setRun] = useState<AuditRunRow | null>(null);
  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [area, setArea] = useState<AreaRow | null>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answersByQ, setAnswersByQ] = useState<Record<string, AnswerRow>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMemberLite[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [employeeName, setEmployeeName] = useState("");

  const submitted = (run?.status ?? "") === "submitted";
  const isHousekeeping = (area?.type ?? "").toUpperCase() === "HK";
  const requiresRoomNumber = template?.require_room_number === true;
  const requiresAuditedEmployee = template?.require_audited_employee === true;
  const showRoomNumberField = isHousekeeping || requiresRoomNumber;

  useEffect(() => {
    if (!runId) return;

    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);
      setIsOfflineMode(false);

      try {
        const session = await loadAuditSession(runId);
        if (!alive) return;

        // Cache full session so subsequent offline loads work
        void cacheSession(runId, session);

        setRun(session.run);
        setTemplate(session.template);
        setArea(session.area);
        setSections(session.sections);
        setQuestions(session.questions);
        setAnswersByQ(session.answersByQ);
        setTeamMembers(session.teamMembers);
        setSelectedMember(session.run.team_member_id ?? "");
        setRoomNumber(session.run.room_number ?? "");
        setEmployeeName((session.run as any).employee_name ?? "");
        setLoading(false);
      } catch (sessionError: unknown) {
        if (!alive) return;

        // Network failed — attempt offline recovery from IndexedDB
        try {
          const [cached, localAnswers] = await Promise.all([
            loadCachedSession(runId),
            loadLocalAnswers(runId),
          ]);

          if (cached && alive) {
            // Local answer writes (saveAnswerLocally) are more recent than the
            // server snapshot — overlay them so the auditor sees their own edits.
            const merged = { ...cached.answersByQ };
            for (const [qId, ans] of Object.entries(localAnswers)) {
              merged[qId] = ans;
            }

            setRun(cached.run);
            setTemplate(cached.template);
            setArea(cached.area);
            setSections(cached.sections);
            setQuestions(cached.questions);
            setAnswersByQ(merged);
            setTeamMembers(cached.teamMembers);
            setSelectedMember(cached.run.team_member_id ?? "");
            setRoomNumber(cached.run.room_number ?? "");
            setEmployeeName((cached.run as any).employee_name ?? "");
            setIsOfflineMode(true);
            setLoading(false);
            return;
          }
        } catch {
          // IDB unavailable — fall through to normal error
        }

        setError(getErrorMessage(sessionError, "Error cargando auditoría."));
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [runId]);

  const totals = useMemo(() => {
    const total = questions.length;
    let answered = 0;
    let fail = 0;
    let na = 0;

    for (const question of questions) {
      const answer = answersByQ[question.id];
      const value = (answer?.answer ?? answer?.result ?? null) as AnswerValue | null;
      if (!value) continue;
      answered += 1;
      if (value === "FAIL") fail += 1;
      if (value === "NA") na += 1;
    }

    const denom = Math.max(0, total - na);
    const pass = Math.max(0, denom - fail);
    const score = denom === 0 ? null : Math.round((pass / denom) * 100 * 10) / 10;

    return { total, answered, fail, na, denom, pass, score };
  }, [answersByQ, questions]);

  const groupedQuestions = useMemo(() => {
    const grouped: Record<string, QuestionRow[]> = {};
    for (const question of questions) {
      if (!grouped[question.audit_section_id]) {
        grouped[question.audit_section_id] = [];
      }
      grouped[question.audit_section_id]!.push(question);
    }
    return grouped;
  }, [questions]);

  return {
    loading, error, setError,
    run, setRun,
    template, area, sections, questions,
    answersByQ, setAnswersByQ,
    teamMembers,
    selectedMember, setSelectedMember,
    roomNumber, setRoomNumber,
    employeeName, setEmployeeName,
    submitted, isHousekeeping, requiresRoomNumber, requiresAuditedEmployee, showRoomNumberField,
    totals, groupedQuestions,
    isOfflineMode,
  };
}