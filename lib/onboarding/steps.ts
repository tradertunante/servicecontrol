import type { Step } from "react-joyride";
import type { Role } from "@/lib/types";

const BASE_STEPS: Step[] = [
  {
    target: "body",
    content:
      "¡Bienvenido a ServiceControl! Te guiaremos por las funciones principales.",
    placement: "center",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="header-actions"]',
    content:
      "Desde aquí puedes gestionar notificaciones, acceder al panel de administración, iniciar una auditoría o consultar tu perfil.",
    placement: "bottom-end",
    skipBeacon: true,
  },
  {
    target: "main",
    content:
      "Este es tu panel principal con la visión general de las operaciones del hotel.",
    placement: "center",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="gauges"]',
    content:
      "Los tres indicadores clave: cumplimiento del mes en curso, del trimestre y del año completo. Compara con el período anterior de un vistazo.",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="heatmap"]',
    content:
      "El mapa de tendencia muestra la evolución mensual de cada departamento. De un color más intenso a más suave según el rendimiento.",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="area-trend"]',
    content:
      "El desarrollo histórico refleja la trayectoria de cada área a lo largo del tiempo. Identifica quién mejora y quién se estanca.",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="area-rankings"]',
    content:
      "Top 3 departamentos con mejor y peor performance. Accede directamente al detalle de cada área.",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="worst-audits"]',
    content:
      "Las 3 auditorías con peor puntuación del período. Úsalas como punto de partida para acciones correctivas.",
    skipBeacon: true,
  },
];

const ROLE_STEPS: Partial<Record<Role, Step[]>> = {
  manager: [
    {
      target: '[data-onboarding="kpis"]',
      content: "Aquí tienes los KPIs de rendimiento de tu equipo en tiempo real.",
      skipBeacon: true,
    },
    {
      target: '[data-onboarding="reports"]',
      content: "Accede a los reportes detallados de auditorías por área y período.",
      skipBeacon: true,
    },
    {
      target: '[data-onboarding="team-tracking"]',
      content: "Sigue el progreso y cumplimiento de cada miembro de tu equipo.",
      skipBeacon: true,
    },
  ],
  auditor: [
    {
      target: '[data-onboarding="start-audit"]',
      content: "Desde aquí inicias una nueva auditoría seleccionando el área y plantilla.",
      skipBeacon: true,
    },
    {
      target: '[data-onboarding="audit-questions"]',
      content: "Responde cada pregunta. Puedes adjuntar fotos como evidencia.",
      skipBeacon: true,
    },
    {
      target: '[data-onboarding="submit-audit"]',
      content: "Cuando completes todas las preguntas, envía la auditoría para revisión.",
      skipBeacon: true,
    },
  ],
  quality: [
    {
      target: '[data-onboarding="review"]',
      content: "Revisa las auditorías completadas por el equipo de campo.",
      skipBeacon: true,
    },
    {
      target: '[data-onboarding="corrective-actions"]',
      content:
        "Gestiona las acciones correctivas generadas automáticamente por las auditorías.",
      skipBeacon: true,
    },
    {
      target: '[data-onboarding="action-tracking"]',
      content:
        "Sigue el estado de cada acción correctiva hasta su cierre y verificación.",
      skipBeacon: true,
    },
  ],
};

export function getOnboardingSteps(role: Role): Step[] {
  const roleSteps = ROLE_STEPS[role] ?? [];
  return [...BASE_STEPS, ...roleSteps];
}

export type OnboardingModule = "main" | "audits" | "team" | "builder";
