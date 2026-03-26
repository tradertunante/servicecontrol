/**
 * One-time script to set lookup_keys on Stripe prices.
 *
 * Stripe doesn't allow editing lookup_key after creation, so this script:
 * 1. Lists all active prices
 * 2. For each, creates a NEW price on the same product with the correct lookup_key
 * 3. Archives the old price
 *
 * Run with: npx tsx scripts/stripe-setup-lookup-keys.ts
 */

import Stripe from "stripe";
import "dotenv/config";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY in .env");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { typescript: true });

// Map unit_amount (in cents) → lookup_key
const AMOUNT_TO_LOOKUP: Record<number, string> = {
  29900: "starter_month",
  50000: "professional_month",
  70000: "enterprise_month",
};

async function main() {
  console.log("Fetching active prices...\n");

  const prices = await stripe.prices.list({ active: true, limit: 100, expand: ["data.product"] });

  const relevantPrices = prices.data.filter(
    (p) => p.unit_amount !== null && AMOUNT_TO_LOOKUP[p.unit_amount],
  );

  if (relevantPrices.length === 0) {
    console.log("No matching prices found. Check your products in Stripe.");
    console.log("Expected amounts (in cents): 29900, 50000, 70000");
    console.log("\nAll active prices:");
    for (const p of prices.data) {
      const productName = typeof p.product === "object" ? (p.product as Stripe.Product).name : p.product;
      console.log(`  ${p.id} — ${productName} — ${p.unit_amount} ${p.currency} — lookup_key: ${p.lookup_key ?? "(none)"}`);
    }
    return;
  }

  for (const oldPrice of relevantPrices) {
    const lookupKey = AMOUNT_TO_LOOKUP[oldPrice.unit_amount!];
    const productId = typeof oldPrice.product === "string" ? oldPrice.product : (oldPrice.product as Stripe.Product).id;
    const productName = typeof oldPrice.product === "object" ? (oldPrice.product as Stripe.Product).name : productId;

    // Skip if already has the correct lookup_key
    if (oldPrice.lookup_key === lookupKey) {
      console.log(`✓ ${productName} (${oldPrice.id}) already has lookup_key="${lookupKey}"`);
      continue;
    }

    console.log(`→ ${productName}: creating new price with lookup_key="${lookupKey}"...`);

    // Create new price with lookup_key
    const newPrice = await stripe.prices.create({
      product: productId,
      unit_amount: oldPrice.unit_amount!,
      currency: oldPrice.currency,
      recurring: { interval: oldPrice.recurring?.interval ?? "month" },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      metadata: { plan_code: lookupKey.replace("_month", "").replace("_year", "") },
    });

    // Archive old price
    await stripe.prices.update(oldPrice.id, { active: false });

    console.log(`  ✓ New price: ${newPrice.id} (old ${oldPrice.id} archived)`);
  }

  console.log("\nDone! Verifying lookup_keys...\n");

  // Verify
  for (const key of Object.values(AMOUNT_TO_LOOKUP)) {
    const result = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
    if (result.data.length > 0) {
      console.log(`  ✓ ${key} → ${result.data[0].id}`);
    } else {
      console.log(`  ✗ ${key} → NOT FOUND`);
    }
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
