import "server-only";

import { getResend } from "./resend";
import { logger } from "@/lib/logger";

type CheckoutNotificationData = {
  customerEmail: string;
  planCode: string;
  billingAccountId: string;
  sessionId: string;
  hotelId: string | null;
  hotelCreated: boolean;
};

/**
 * Aviso interno al equipo de ventas cuando un checkout de Stripe se completa.
 * El alta del hotel es automática (lib/billing/provisioning.ts); este email es
 * informativo y para el follow-up comercial. Si falla, solo se loguea.
 */
export async function sendCheckoutNotificationEmail(data: CheckoutNotificationData) {
  const to = process.env.SALES_NOTIFICATION_EMAIL;
  if (!to) {
    logger.warn("checkout_notification_skipped_no_recipient", { sessionId: data.sessionId });
    return;
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "app@servicecontrol.io";
  const hotelLine = data.hotelId
    ? data.hotelCreated
      ? `Hotel creado automáticamente: ${data.hotelId}`
      : `Hotel vinculado: ${data.hotelId}`
    : "⚠️ No se pudo aprovisionar hotel — revisar logs (provisioning).";

  const lines = [
    "Checkout de Stripe completado.",
    "",
    `Cliente: ${data.customerEmail}`,
    `Plan: ${data.planCode}`,
    hotelLine,
    `Billing account: ${data.billingAccountId}`,
    `Sesión: ${data.sessionId}`,
    "",
    "El cliente ya tiene acceso como admin de su hotel. Siguiente paso: onboarding comercial (llamada de bienvenida, plantillas de auditoría).",
  ];

  await getResend().emails.send({
    from: `ServiceControl <${fromAddress}>`,
    to,
    subject: `💰 Nueva suscripción: ${data.customerEmail} · plan ${data.planCode}`,
    text: lines.join("\n"),
  });
}
