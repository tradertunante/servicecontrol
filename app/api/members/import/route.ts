import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseBooleanLike, parseMemberImportRows, normalizeAreaLabel, splitAreas } from "@/lib/members/import";
import {
  findDuplicateMemberByEmployeeNumber,
  getAllowedAreaIds,
  getHotelAreas,
  getMembersCaller,
  resolveMembersHotelId,
  uniqueStrings,
} from "@/lib/members/server";
import { jsonError , jsonDbError } from "@/lib/api/response";
import { validateSpreadsheetUpload } from "@/lib/api/validateUpload";

export async function POST(request: NextRequest) {
  try {
    const callerResult = await getMembersCaller(request);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    const formData = await request.formData();
    const file = formData.get("file");
    const hotelResult = await resolveMembersHotelId(callerResult.caller);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const upload = await validateSpreadsheetUpload(file);
    if (!upload.ok) return upload.response;

    const workbook = XLSX.read(upload.arrayBuffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return jsonError("El archivo no contiene hojas.", 400);
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
      raw: false,
    });

    const parsed = parseMemberImportRows(rawRows);
    if (!parsed.ok) {
      return jsonError(parsed.error, 400);
    }

    const admin = supabaseAdmin();
    const hotelAreas = await getHotelAreas(admin, hotelResult.hotelId);
    const hotelAreaIds = hotelAreas.map((area) => area.id);
    const allowedAreaIds = await getAllowedAreaIds(admin, callerResult.caller, hotelResult.hotelId, hotelAreaIds);
    const allowedAreaSet = new Set(allowedAreaIds);
    const areaByNormalizedName = new Map(
      hotelAreas.map((area) => [normalizeAreaLabel(area.name), area])
    );

    const rowResults: Array<{
      row_number: number;
      status: "created" | "skipped" | "error";
      message: string;
      employee_number: string;
      full_name: string;
    }> = [];
    const createdMembers: Array<{
      id: string;
      full_name: string;
      employee_number: string;
      active: boolean;
      area_ids: string[];
      area_names: string[];
    }> = [];
    const fileEmployeeNumbers = new Map<string, number>();

    for (const row of parsed.rows) {
      const fullName = row.full_name.trim();
      const employeeNumber = row.employee_number.trim();

      if (!fullName) {
        rowResults.push({
          row_number: row.row_number,
          status: "error",
          message: "full_name es obligatorio.",
          employee_number: employeeNumber,
          full_name: fullName,
        });
        continue;
      }

      if (!employeeNumber) {
        rowResults.push({
          row_number: row.row_number,
          status: "error",
          message: "employee_number es obligatorio.",
          employee_number: employeeNumber,
          full_name: fullName,
        });
        continue;
      }

      if (fileEmployeeNumbers.has(employeeNumber)) {
        rowResults.push({
          row_number: row.row_number,
          status: "error",
          message: `employee_number duplicado dentro del archivo; ya apareció en la fila ${fileEmployeeNumbers.get(employeeNumber)}.`,
          employee_number: employeeNumber,
          full_name: fullName,
        });
        continue;
      }

      fileEmployeeNumbers.set(employeeNumber, row.row_number);

      const activeResult = parseBooleanLike(row.active);
      if (!activeResult.ok) {
        rowResults.push({
          row_number: row.row_number,
          status: "error",
          message: activeResult.error,
          employee_number: employeeNumber,
          full_name: fullName,
        });
        continue;
      }

      const areaLabels = splitAreas(row.areas);
      const areaIds = uniqueStrings(
        areaLabels.map((areaLabel) => areaByNormalizedName.get(normalizeAreaLabel(areaLabel))?.id)
      );
      const missingAreas = areaLabels.filter((areaLabel) => !areaByNormalizedName.has(normalizeAreaLabel(areaLabel)));

      if (missingAreas.length > 0) {
        rowResults.push({
          row_number: row.row_number,
          status: "error",
          message: `Estas areas no existen en el hotel actual: ${missingAreas.join(", ")}.`,
          employee_number: employeeNumber,
          full_name: fullName,
        });
        continue;
      }

      if (areaIds.some((areaId) => !allowedAreaSet.has(areaId))) {
        rowResults.push({
          row_number: row.row_number,
          status: "error",
          message: "La fila incluye areas fuera de tu alcance permitido.",
          employee_number: employeeNumber,
          full_name: fullName,
        });
        continue;
      }

      const duplicateMember = await findDuplicateMemberByEmployeeNumber(admin, hotelResult.hotelId, employeeNumber);
      if (duplicateMember) {
        rowResults.push({
          row_number: row.row_number,
          status: "skipped",
          message: "El numero de colaborador ya existe en este hotel.",
          employee_number: employeeNumber,
          full_name: fullName,
        });
        continue;
      }

      const { data: member, error: insertError } = await admin
        .from("team_members")
        .insert({
          hotel_id: hotelResult.hotelId,
          full_name: fullName,
          employee_number: employeeNumber,
          active: activeResult.value,
        })
        .select("id, full_name, employee_number, active")
        .single();

      if (insertError || !member) {
        const duplicateMessage =
          insertError?.code === "23505"
            ? "El numero de colaborador ya existe en este hotel."
            : insertError?.message ?? "No se pudo crear el miembro.";

        rowResults.push({
          row_number: row.row_number,
          status: insertError?.code === "23505" ? "skipped" : "error",
          message: duplicateMessage,
          employee_number: employeeNumber,
          full_name: fullName,
        });
        continue;
      }

      if (areaIds.length > 0) {
        const { error: linksError } = await admin.from("team_member_areas").insert(
          areaIds.map((areaId) => ({
            team_member_id: member.id,
            area_id: areaId,
          }))
        );

        if (linksError) {
          await admin.from("team_members").delete().eq("id", member.id).eq("hotel_id", hotelResult.hotelId);

          rowResults.push({
            row_number: row.row_number,
            status: "error",
            message: linksError.message,
            employee_number: employeeNumber,
            full_name: fullName,
          });
          continue;
        }
      }

      createdMembers.push({
        id: String(member.id),
        full_name: String(member.full_name ?? fullName),
        employee_number: String(member.employee_number ?? employeeNumber),
        active: member.active ?? true,
        area_ids: areaIds,
        area_names: areaIds
          .map((areaId) => hotelAreas.find((area) => area.id === areaId)?.name ?? areaId),
      });

      rowResults.push({
        row_number: row.row_number,
        status: "created",
        message: areaIds.length > 0 ? "Miembro creado con areas asignadas." : "Miembro creado sin areas asignadas.",
        employee_number: employeeNumber,
        full_name: fullName,
      });
    }

    const createdCount = rowResults.filter((row) => row.status === "created").length;
    const skippedCount = rowResults.filter((row) => row.status === "skipped").length;
    const errorCount = rowResults.filter((row) => row.status === "error").length;

    return NextResponse.json({
      ok: true,
      hotel_id: hotelResult.hotelId,
      total_rows: parsed.rows.length,
      created_count: createdCount,
      skipped_count: skippedCount,
      error_count: errorCount,
      created_members: createdMembers,
      row_results: rowResults,
    });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}
