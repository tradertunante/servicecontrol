import { describe, expect, it } from "vitest";

import {
  mapRunAccessFailureToSubmitFailure,
} from "@/lib/audits/submitContract";
import type { RunAccessFailure } from "@/lib/audits/server";

function failure(
  code: RunAccessFailure["code"],
  status = 403,
  error = "mensaje de dominio",
): RunAccessFailure {
  return { ok: false, code, status, error };
}

describe("mapRunAccessFailureToSubmitFailure", () => {
  it("maps a run lookup DB error to a 500 internal failure", () => {
    expect(mapRunAccessFailureToSubmitFailure(failure("RUN_LOOKUP_FAILED", 500))).toEqual({
      code: "RUN_LOOKUP_FAILED",
      message: "Error interno al buscar la auditoría.",
      status: 500,
      errorType: "internal",
      field: "run_id",
      details: {},
    });
  });

  it("disguises a missing run as the same 403 as a hotel mismatch", () => {
    const notFound = mapRunAccessFailureToSubmitFailure(failure("RUN_NOT_FOUND", 404));
    const mismatch = mapRunAccessFailureToSubmitFailure(failure("HOTEL_MISMATCH", 403));

    expect(notFound).toEqual(mismatch);
    expect(notFound).toEqual({
      code: "FORBIDDEN",
      message: "La auditoría no pertenece al hotel activo.",
      status: 403,
      errorType: "authorization",
      field: "run_id",
      details: {},
    });
  });

  it("uses the submit-specific wording for auditor ownership", () => {
    expect(mapRunAccessFailureToSubmitFailure(failure("AUDITOR_OWNERSHIP"))).toMatchObject({
      code: "FORBIDDEN",
      message: "Un auditor solo puede enviar auditorías ejecutadas por sí mismo.",
      status: 403,
    });
  });

  it("passes through hotel scope failures with their original message and status", () => {
    expect(
      mapRunAccessFailureToSubmitFailure(failure("HOTEL_SCOPE", 409, "Selecciona un hotel activo.")),
    ).toMatchObject({
      code: "FORBIDDEN",
      message: "Selecciona un hotel activo.",
      status: 409,
      errorType: "authorization",
    });
  });

  it("maps area scope failures preserving the domain message", () => {
    expect(
      mapRunAccessFailureToSubmitFailure(
        failure("AREA_SCOPE", 403, "No tienes acceso al área de esta auditoría."),
      ),
    ).toMatchObject({
      code: "FORBIDDEN",
      message: "No tienes acceso al área de esta auditoría.",
      status: 403,
    });
  });
});
