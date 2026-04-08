import type { Step } from "react-joyride";

export const TEAM_STEPS: Step[] = [
  {
    target: "body",
    content: "Bienvenido al panel de equipo. Desde aquí gestionas el rendimiento operativo de cada área.",
    placement: "center",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="team-header"]',
    content: "El encabezado muestra tu área activa y el período seleccionado. Puedes cambiar de área desde el selector.",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="team-nav"]',
    content: "Las pestañas te dan acceso a cada sección: rendimiento general, progreso por plantilla, historial de auditorías, recuperaciones y más.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="team-general"]',
    content: "La vista General muestra el score del área, la última auditoría, la sección más débil y la más fuerte.",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="team-fail-ranking"]',
    spotlightTarget: '[data-onboarding="team-fail-ranking-card"]',
    content: "El ranking de FAILs identifica los estándares y clasificaciones con más fallos. Es el punto de partida para acciones correctivas.",
    placement: "bottom-start",
    skipBeacon: true,
  },
];
