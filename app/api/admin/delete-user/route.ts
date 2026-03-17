import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { deleteManagedUser } from "@/lib/auth/userManagement";

export async function POST(request: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

    const body = await request.json().catch(() => null);
    const result = await deleteManagedUser(caller.profile, String(body?.user_id ?? "").trim());
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error inesperado." },
      { status: 500 }
    );
  }
}
