import type { Step } from "react-joyride";

// Tour de selección de plantilla (pantalla "Auditar")
export const AUDITAR_STEPS: Step[] = [
  {
    target: "body",
    content: "Esta es la pantalla de inicio de auditoría. Selecciona el área activa y elige qué tipo de auditoría quieres ejecutar.",
    placement: "center",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="team-header"]',
    content: "Puedes cambiar el área activa desde el selector superior. Cada área tiene sus propias plantillas asignadas.",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="templates-title"]',
    content: "Las auditorías disponibles son las plantillas activas asignadas a esta área. Cada plantilla tiene sus propias secciones y preguntas.",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="templates-grid"]',
    content: "Haz clic en 'Iniciar' para comenzar una auditoría. Se creará una sesión nueva que puedes completar en el momento.",
    placement: "top",
    skipBeacon: true,
  },
];

// Tour de la auditoría concreta (pantalla /audits/[id])
export const AUDIT_SESSION_STEPS: Step[] = [
  {
    target: "body",
    content: "Has iniciado una auditoría. Todas las preguntas están prerespondidas como PASS: si envías sin tocar nada el resultado será 100%. Solo marca FAIL donde realmente haya un problema.",
    placement: "center",
    skipBeacon: true,
  },
  {
    target: "body",
    content: "El encabezado muestra el nombre de la plantilla, el área y la fecha de ejecución. Puedes seleccionar el colaborador auditado antes de comenzar a responder.",
    placement: "center",
    skipBeacon: true,
  },
  {
    target: "body",
    content: "Responde cada estándar con PASS o FAIL. Si marcas FAIL puedes añadir un comentario y adjuntar una foto como evidencia.",
    placement: "center",
    skipBeacon: true,
  },
  {
    target: "body",
    content: "Cuando hayas revisado todos los estándares, pulsa 'Enviar' en la parte inferior para registrar la auditoría.",
    placement: "center",
    skipBeacon: true,
  },
];
