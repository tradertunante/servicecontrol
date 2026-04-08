import type { Step } from "react-joyride";

export const ADMIN_STEPS: Step[] = [
  {
    target: "body",
    content: "Bienvenido al panel de administración. Desde aquí controlas toda la configuración del hotel.",
    placement: "center",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="admin-sidebar"]',
    content: "El menú lateral te da acceso a cada módulo: hotel, departamentos, usuarios, estándares, objetivos, reportes y notificaciones.",
    placement: "right",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="admin-hotel"]',
    content: "Configura la información del hotel: nombre, umbrales de calidad y parámetros generales.",
    placement: "right",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="admin-departments"]',
    content: "Gestiona los departamentos operativos del hotel y su estructura.",
    placement: "right",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="admin-builder"]',
    content: "La biblioteca de estándares es donde defines las plantillas de auditoría: secciones, preguntas y criterios de evaluación.",
    placement: "right",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="admin-users"]',
    content: "Administra los usuarios del hotel: crea cuentas, asigna roles y gestiona accesos.",
    placement: "right",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="admin-targets"]',
    content: "Define los objetivos de cumplimiento por departamento y período.",
    placement: "right",
    skipBeacon: true,
  },
  {
    target: '[data-onboarding="admin-notifications"]',
    content: "Controla qué eventos generan notificaciones, a quién se les notifica, y configura el envío automático de reportes por email.",
    placement: "right",
    skipBeacon: true,
  },
];
