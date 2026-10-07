/**
 * Crea (si no existe) el cupón y el código de promoción del programa
 * "hoteles fundadores": mes 1 gratis + 50% de descuento durante los 6 meses
 * siguientes, limitado a 5 usos (las "5 plazas" del programa).
 *
 * Idempotente: se puede ejecutar varias veces sin duplicar nada.
 *
 * El mes 1 gratis NO se configura aquí: lo aplica
 * `app/api/billing/checkout/route.ts` vía `subscription_data.trial_period_days`
 * cuando se usa este código, porque un Coupon de Stripe no puede combinar un
 * periodo al 100% con una duración distinta al 50%.
 *
 * Ejecutar manualmente: npx tsx scripts/stripe-sync-founder-coupon.ts
 */

import Stripe from "stripe";
import "dotenv/config";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY in .env");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { typescript: true });

const COUPON_ID = "founder-50-6m";
const PROMO_CODE = "FUNDADOR50";
const MAX_REDEMPTIONS = 5;

async function main() {
  let coupon: Stripe.Coupon;
  try {
    coupon = await stripe.coupons.retrieve(COUPON_ID);
    console.log(`Cupón "${COUPON_ID}" ya existe.`);
  } catch {
    coupon = await stripe.coupons.create({
      id: COUPON_ID,
      name: "Fundador — 50% × 6 meses",
      percent_off: 50,
      duration: "repeating",
      duration_in_months: 6,
    });
    console.log(`Cupón "${COUPON_ID}" creado.`);
  }

  const existingPromos = await stripe.promotionCodes.list({ code: PROMO_CODE, limit: 1 });
  if (existingPromos.data.length > 0) {
    console.log(`Código de promoción "${PROMO_CODE}" ya existe (id: ${existingPromos.data[0].id}).`);
    console.log(`Usos: ${existingPromos.data[0].times_redeemed} / ${existingPromos.data[0].max_redemptions ?? "∞"}`);
    return;
  }

  const promo = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: PROMO_CODE,
    max_redemptions: MAX_REDEMPTIONS,
  });
  console.log(`Código de promoción "${PROMO_CODE}" creado (id: ${promo.id}, máx. ${MAX_REDEMPTIONS} usos).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
