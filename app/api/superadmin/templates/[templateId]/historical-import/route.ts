import { jsonError } from "@/lib/superadmin/server";

export async function GET() {
  return jsonError(
    "Esta ruta histórica por template fue retirada. Usa /api/superadmin/historical-import.",
    410,
  );
}

export async function POST() {
  return jsonError(
    "Esta ruta histórica por template fue retirada. Usa /api/superadmin/historical-import.",
    410,
  );
}
