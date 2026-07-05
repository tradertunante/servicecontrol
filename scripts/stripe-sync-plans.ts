/**
 * Sincroniza los planes públicos (lib/billing/plans.ts) con Stripe.
 * Idempotente: se puede ejecutar tantas veces como haga falta.
 *
 * Por cada plan crea (si no existe) un Product y dos Prices con lookup_key
 * `{code}_month` (mensual) y `{code}_year` (anual, facturado por año), que es
 * la convención que usa /api/billing/checkout. Si un lookup_key ya existe con
 * otro importe, crea el price nuevo con transfer_lookup_key y archiva el viejo.
 *
 * También archiva los prices del catálogo antiguo (starter/professional/enterprise).
 *
 * Ejecutar: npx tsx scripts/stripe-sync-plans.ts
 */

import Stripe from "stripe";
import "dotenv/config";

import { PLANS } from "../lib/billing/plans";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY in .env");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { typescript: true });

const LEGACY_LOOKUP_KEYS = [
  "starter_month",
  "starter_year",
  "professional_month",
  "professional_year",
  "enterprise_month",
  "enterprise_year",
];

type TargetPrice = {
  lookupKey: string;
  unitAmount: number; // cents
  interval: "month" | "year";
};

async function findOrCreateProduct(planCode: string, name: string): Promise<Stripe.Product> {
  const existing = await stripe.products.search({
    query: `active:'true' AND metadata['plan_code']:'${planCode}'`,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0];

  console.log(`→ Creando producto "${name}" (${planCode})`);
  return stripe.products.create({
    name: `ServiceControl ${name}`,
    metadata: { plan_code: planCode },
  });
}

async function ensurePrice(product: Stripe.Product, planCode: string, target: TargetPrice) {
  const existing = await stripe.prices.list({
    lookup_keys: [target.lookupKey],
    active: true,
    limit: 1,
  });
  const current = existing.data[0];

  if (
    current &&
    current.unit_amount === target.unitAmount &&
    current.currency === "eur" &&
    current.recurring?.interval === target.interval
  ) {
    console.log(`✓ ${target.lookupKey} ya existe (${current.id}, ${target.unitAmount / 100}€/${target.interval})`);
    return;
  }

  console.log(
    `→ ${target.lookupKey}: creando price ${target.unitAmount / 100}€/${target.interval}` +
      (current ? ` (reemplaza ${current.id})` : ""),
  );

  const newPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: target.unitAmount,
    currency: "eur",
    recurring: { interval: target.interval },
    lookup_key: target.lookupKey,
    transfer_lookup_key: true,
    metadata: { plan_code: planCode },
  });

  if (current) await stripe.prices.update(current.id, { active: false });
  console.log(`  ✓ ${newPrice.id}`);
}

async function archiveLegacyPrices() {
  const result = await stripe.prices.list({ lookup_keys: LEGACY_LOOKUP_KEYS, active: true, limit: 100 });
  for (const price of result.data) {
    console.log(`→ Archivando price legacy ${price.lookup_key} (${price.id})`);
    const productId = typeof price.product === "string" ? price.product : price.product?.id;
    if (productId) {
      // Un price default de su producto no se puede archivar: desvincular antes.
      await stripe.products
        .update(productId, { default_price: "" as unknown as string, active: false })
        .catch(() => stripe.products.update(productId, { active: false }).catch(() => undefined));
    }
    await stripe.prices.update(price.id, { active: false }).catch((err) => {
      console.log(`  ⚠️ No se pudo archivar ${price.id}: ${err instanceof Error ? err.message : err}`);
    });
  }
  if (result.data.length === 0) console.log("✓ Sin prices legacy activos");
}

async function main() {
  for (const plan of PLANS) {
    const product = await findOrCreateProduct(plan.code, plan.name);
    await ensurePrice(product, plan.code, {
      lookupKey: `${plan.code}_month`,
      unitAmount: plan.monthly * 100,
      interval: "month",
    });
    await ensurePrice(product, plan.code, {
      lookupKey: `${plan.code}_year`,
      unitAmount: plan.annual * 12 * 100,
      interval: "year",
    });
  }

  await archiveLegacyPrices();

  console.log("\nVerificación final:");
  for (const plan of PLANS) {
    for (const interval of ["month", "year"] as const) {
      const key = `${plan.code}_${interval}`;
      const r = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
      console.log(r.data[0] ? `  ✓ ${key} → ${r.data[0].id}` : `  ✗ ${key} → NO ENCONTRADO`);
    }
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
