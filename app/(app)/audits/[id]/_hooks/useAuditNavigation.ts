"use client";

import { useEffect, useMemo, useState } from "react";
import type { QuestionRow, SectionRow } from "./useAuditSession";

export function useAuditNavigation({
  sections,
  questions,
}: {
  sections: SectionRow[];
  questions: QuestionRow[];
}) {
  const orderedQuestionIds = useMemo(() => questions.map((question) => question.id), [questions]);

  const questionSectionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const question of questions) {
      map.set(question.id, question.audit_section_id);
    }
    return map;
  }, [questions]);

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(orderedQuestionIds[0] ?? null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    if (!orderedQuestionIds.length) {
      setActiveQuestionId(null);
      setActiveSectionId(sections[0]?.id ?? null);
      return;
    }

    setActiveQuestionId((prev) => (prev && orderedQuestionIds.includes(prev) ? prev : orderedQuestionIds[0]));
  }, [orderedQuestionIds, sections]);

  useEffect(() => {
    if (!activeQuestionId) return;
    const nextSectionId = questionSectionMap.get(activeQuestionId) ?? null;
    if (nextSectionId) {
      setActiveSectionId(nextSectionId);
    }
  }, [activeQuestionId, questionSectionMap]);

  const currentQuestionIndex = activeQuestionId ? orderedQuestionIds.indexOf(activeQuestionId) : -1;
  const hasPrevious = currentQuestionIndex > 0;
  const hasNext = currentQuestionIndex >= 0 && currentQuestionIndex < orderedQuestionIds.length - 1;

  function goToQuestion(questionId: string) {
    if (!questionSectionMap.has(questionId)) return;
    setActiveQuestionId(questionId);
    setActiveSectionId(questionSectionMap.get(questionId) ?? null);
  }

  function goToSection(sectionId: string) {
    const firstQuestion = questions.find((question) => question.audit_section_id === sectionId);
    setActiveSectionId(sectionId);
    if (firstQuestion) {
      setActiveQuestionId(firstQuestion.id);
    }
  }

  function goToPreviousQuestion() {
    if (!hasPrevious) return;
    goToQuestion(orderedQuestionIds[currentQuestionIndex - 1]!);
  }

  function goToNextQuestion() {
    if (!hasNext) return;
    goToQuestion(orderedQuestionIds[currentQuestionIndex + 1]!);
  }

  return {
    activeQuestionId,
    activeSectionId,
    hasPrevious,
    hasNext,
    currentQuestionIndex,
    totalQuestions: orderedQuestionIds.length,
    goToQuestion,
    goToSection,
    goToPreviousQuestion,
    goToNextQuestion,
  };
}
