import type { Step } from "react-joyride";

export const PROGRESS_STEPS: Step[] = [
  {
    target: "body",
    content: "La vista de Progreso muestra el cumplimiento del equipo frente a los objetivos definidos.",
    placement: "center",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="team-header"]',
    content: "Selecciona el período (diario, semanal o mensual) para ver el progreso en el rango que necesites.",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="progress-objectives"]',
    content: "Objetivos por rubro: compara las auditorías completadas frente al objetivo asignado para cada plantilla.",
    placement: "top",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="progress-leaderboard"]',
    content: "El leaderboard clasifica a los auditores por número de auditorías realizadas en el período seleccionado.",
    placement: "top",
    skipBeacon: true,
  },
];
