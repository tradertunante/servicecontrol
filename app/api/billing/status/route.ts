import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { getActiveSubscription } from "@/lib/billing/getActiveSubscription";
import { jsonError } from "@/lib/api/response";

/**
 * GET /api/billing/status
 *
 * Returns the current billing state for the authenticated user.
 */
export async function GET(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
  if (!caller) return jsonError("No autorizado.", 401);

  const billing = await getActiveSubscription(caller.profile.id);

  return NextResponse.json({ ok: true, billing });
}
