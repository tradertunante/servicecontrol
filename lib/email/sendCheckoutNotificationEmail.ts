import "server-only";

import { getResend } from "./resend";
import { logger } from "@/lib/logger";

type CheckoutNotificationData = {
  customerEmail: string;
  planCode: string;
  billingAccountId: string;
  sessionId: string;
};

/**
 * Aviso interno al equipo de ventas cuando un checkout de Stripe se completa.
 * El aprovisionamiento del hotel es manual (superadmin), así que este email
 * es lo que dispara el alta: si falla, solo se loguea — nunca rompe el webhook.
 */
export async function sendCheckoutNotificationEmail(data: CheckoutNotificationData) {
  const to = process.env.SALES_NOTIFICATION_EMAIL;
  if (!to) {
    logger.warn("checkout_notification_skipped_no_recipient", { sessionId: data.sessionId });
    return;
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "app@servicecontrol.io";
  const lines = [
    "Checkout de Stripe completado.",
    "",
    `Cliente: ${data.customerEmail}`,
    `Plan: ${data.planCode}`,
    `Billing account: ${data.billingAccountId}`,
    `Sesión: ${data.sessionId}`,
    "",
    "Siguiente paso: crear/vincular su hotel desde /superadmin/hotels y mover al usuario fuera del hotel demo.",
  ];

  await getResend().emails.send({
    from: `ServiceControl <${fromAddress}>`,
    to,
    subject: `💰 Nueva suscripción: ${data.customerEmail} · plan ${data.planCode}`,
    text: lines.join("\n"),
  });
}
