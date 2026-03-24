import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["superadmin", "admin"],
  });

  if (!caller) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const result = await logger.info("better_stack_manual_test", {
    route: "/api/observability/better-stack",
    actor_user_id: caller.profile.id,
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
  });

  return NextResponse.json({
    ok: true,
    logger_configured: logger.configured,
    better_stack_attempted: result.sent,
  });
}
