import { NextRequest, NextResponse } from "next/server";
import { jsonDbError } from "@/lib/api/response";
import * as XLSX from "xlsx";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  HISTORICAL_IMPORT_TEMPLATE_FILE_NAME,
  buildHistoricalImportWorkbook,
} from "@/lib/superadmin/historicalImportExcel";
import { loadOrderedActiveTemplateQuestions } from "@/lib/superadmin/historicalImports";
import { jsonError, requireSuperadminRoute } from "@/lib/superadmin/server";

function cleanCell(value: unknown) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .trim();
}

export async function GET(request: NextRequest) {
  return handleTemplateRequest(
    cleanCell(request.nextUrl.searchParams.get("hotel_id")) || cleanCell(request.nextUrl.searchParams.get("hotelId")),
    cleanCell(request.nextUrl.searchParams.get("template_id")) || cleanCell(request.nextUrl.searchParams.get("templateId")),
    request,
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return handleTemplateRequest(
    cleanCell(body?.hotel_id) || cleanCell(body?.hotelId),
    cleanCell(body?.template_id) || cleanCell(body?.templateId),
    request,
  );
}

async function handleTemplateRequest(hotelId: string, templateId: string, request: NextRequest) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  if (!hotelId) return jsonError("hotel_id es obligatorio.", 400);
  if (!templateId) return jsonError("template_id es obligatorio.", 400);

  const admin = supabaseAdmin();
  const { data: template, error } = await admin
    .from("audit_templates")
    .select("id, hotel_id, active")
    .eq("id", templateId)
    .eq("hotel_id", hotelId)
    .maybeSingle();

  if (error) return jsonDbError(error);
  if (!template?.id) return jsonError("El template seleccionado no pertenece al hotel.", 404);
  if (template.active === false) return jsonError("El template seleccionado está inactivo.", 409);

  try {
    const questions = await loadOrderedActiveTemplateQuestions(String(template.id));
    const workbook = buildHistoricalImportWorkbook(questions);
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${HISTORICAL_IMPORT_TEMPLATE_FILE_NAME}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (loadError) {
    return jsonError(loadError instanceof Error ? loadError.message : "No se pudo generar la plantilla.", 500);
  }
}
