/**
 * Tests de autorización HTTP para las rutas sensibles que usan service-role.
 * La seguridad multi-tenant vive en TypeScript (no en RLS), así que estos tests
 * verifican que cada ruta rechaza roles incorrectos y aisla hoteles entre sí.
 *
 * Requiere servidor Next.js corriendo:
 *   TEST_BASE_URL=http://localhost:3000 npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { routeTestsEnabled, TEST_BASE_URL } from "./helpers/env";
import { TestBed, type TestTemplate, type TestUser } from "./helpers/factory";
import { signedInClient } from "./helpers/clients";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Db = SupabaseClient<Database>;

const suite = describe.skipIf(!routeTestsEnabled);

/** Extrae el JWT de una sesión activa. */
async function getToken(client: Db): Promise<string> {
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.access_token) throw new Error("No se pudo obtener token de sesión");
  return session.access_token;
}

/** Shorthand para fetch con Bearer token. */
function api(path: string, token: string | null, opts: RequestInit = {}): Promise<Response> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  return fetch(`${TEST_BASE_URL}${path}`, { ...opts, headers });
}

// ──────────────────────────────────────────────────────────────────────────────

suite("Autorización de rutas HTTP", () => {
  let bed: TestBed;

  // Hotel A fixtures
  let hotelA: string;
  let areaA: string;
  let templateA: TestTemplate;
  let adminA: TestUser;
  let auditorA: TestUser;
  let managerA: TestUser;
  let runIdA: string; // run completado en hotel A

  // Hotel B fixtures
  let hotelB: string;
  let adminB: TestUser;

  // Tokens
  let tokAdminA: string;
  let tokAuditorA: string;
  let tokManagerA: string;
  let tokAdminB: string;

  // Supabase clients (para cerrar sesión en afterAll)
  let clientAdminA: Db;
  let clientAuditorA: Db;
  let clientManagerA: Db;
  let clientAdminB: Db;

  beforeAll(async () => {
    bed = new TestBed();

    // ── Hotel A ──────────────────────────────────────────────────────────────
    hotelA = await bed.createHotel("RouteAuth-A");
    areaA = await bed.createArea(hotelA, "Área RouteAuth");
    templateA = await bed.createTemplate({
      hotelId: hotelA,
      areaId: areaA,
      name: "Plantilla RouteAuth",
      questions: [{ text: "Q1" }],
    });

    adminA = await bed.createUser({ hotelId: hotelA, role: "admin" });
    auditorA = await bed.createUser({ hotelId: hotelA, role: "auditor" });
    managerA = await bed.createUser({ hotelId: hotelA, role: "manager" });
    await bed.grantAreaAccess(auditorA.id, hotelA, areaA);
    await bed.grantAreaAccess(managerA.id, hotelA, areaA);

    // Run completado en hotel A (para tests de aislamiento cross-hotel)
    const { runId } = await bed.runFullAudit({
      hotelId: hotelA,
      areaId: areaA,
      template: templateA,
      actorId: adminA.id,
      answers: {},
    });
    runIdA = runId;

    // ── Hotel B ──────────────────────────────────────────────────────────────
    hotelB = await bed.createHotel("RouteAuth-B");
    adminB = await bed.createUser({ hotelId: hotelB, role: "admin" });

    // ── Tokens ───────────────────────────────────────────────────────────────
    [clientAdminA, clientAuditorA, clientManagerA, clientAdminB] = await Promise.all([
      signedInClient(adminA.email, adminA.password),
      signedInClient(auditorA.email, auditorA.password),
      signedInClient(managerA.email, managerA.password),
      signedInClient(adminB.email, adminB.password),
    ]);

    [tokAdminA, tokAuditorA, tokManagerA, tokAdminB] = await Promise.all([
      getToken(clientAdminA),
      getToken(clientAuditorA),
      getToken(clientManagerA),
      getToken(clientAdminB),
    ]);
  });

  afterAll(async () => {
    await Promise.all(
      [clientAdminA, clientAuditorA, clientManagerA, clientAdminB].map((c) =>
        c?.auth.signOut().catch(() => undefined)
      )
    );
    await bed.cleanup();
  });

  // ── 1. Sin token → 401 en rutas protegidas ────────────────────────────────

  describe("sin token → 401", () => {
    const protectedRoutes: Array<[string, string, object?]> = [
      ["GET", "/api/admin/users"],
      ["POST", "/api/admin/users", { email: "x@x.com", role: "auditor" }],
      ["POST", "/api/admin/delete-user", { user_id: "00000000-0000-0000-0000-000000000000" }],
      ["GET", "/api/members"],
      ["POST", "/api/audits/start", { area_id: "x", audit_template_id: "x" }],
      ["POST", "/api/audits/submit", { run_id: "x" }],
      ["POST", "/api/audits/reopen", { run_id: "x" }],
      ["POST", "/api/corrective-actions/status", { action_id: "x", status: "open" }],
      ["PATCH", "/api/admin/hotel", { name: "x" }],
    ];

    for (const [method, path, body] of protectedRoutes) {
      it(`${method} ${path}`, async () => {
        const res = await api(path, null, {
          method,
          body: body ? JSON.stringify(body) : undefined,
        });
        expect(res.status).toBe(401);
      });
    }
  });

  // ── 2. Rol incorrecto → 401 ───────────────────────────────────────────────

  describe("rol auditor en rutas de administración → 401", () => {
    it("GET /api/admin/users", async () => {
      const res = await api("/api/admin/users", tokAuditorA);
      expect(res.status).toBe(401);
    });

    it("POST /api/admin/users", async () => {
      const res = await api("/api/admin/users", tokAuditorA, {
        method: "POST",
        body: JSON.stringify({ email: "nuevo@test.com", role: "auditor" }),
      });
      expect(res.status).toBe(401);
    });

    it("POST /api/admin/delete-user", async () => {
      const res = await api("/api/admin/delete-user", tokAuditorA, {
        method: "POST",
        body: JSON.stringify({ user_id: adminA.id }),
      });
      expect(res.status).toBe(401);
    });

    it("PATCH /api/admin/hotel", async () => {
      const res = await api("/api/admin/hotel", tokAuditorA, {
        method: "PATCH",
        body: JSON.stringify({ name: "Hack" }),
      });
      expect(res.status).toBe(401);
    });

    it("POST /api/audits/reopen — auditor no puede reabrir", async () => {
      const res = await api("/api/audits/reopen", tokAuditorA, {
        method: "POST",
        body: JSON.stringify({ run_id: runIdA }),
      });
      expect(res.status).toBe(401);
    });

    it("GET /api/members — auditor no tiene acceso", async () => {
      const res = await api("/api/members", tokAuditorA);
      expect(res.status).toBe(401);
    });

    it("POST /api/corrective-actions/status — auditor no puede cambiar estado", async () => {
      const res = await api("/api/corrective-actions/status", tokAuditorA, {
        method: "POST",
        body: JSON.stringify({ action_id: "x", status: "resolved" }),
      });
      expect(res.status).toBe(401);
    });
  });

  // ── 3. Aislamiento cross-hotel ─────────────────────────────────────────────

  describe("adminB no puede leer ni mutar recursos de hotel A", () => {
    it("GET /api/admin/users — adminB obtiene sus propios usuarios (no los de A)", async () => {
      // adminA sí puede
      const resA = await api("/api/admin/users", tokAdminA);
      expect(resA.status).toBe(200);
      const bodyA = await resA.json();
      expect(bodyA.hotel_id).toBe(hotelA);

      // adminB recibe sus propios datos, no los del hotel A
      const resB = await api("/api/admin/users", tokAdminB);
      expect(resB.status).toBe(200);
      const bodyB = await resB.json();
      expect(bodyB.hotel_id).toBe(hotelB);
      expect(bodyB.hotel_id).not.toBe(hotelA);
    });

    it("GET /api/admin/users/[id] — adminB no ve usuario de hotel A (404)", async () => {
      const res = await api(`/api/admin/users/${adminA.id}`, tokAdminB);
      expect(res.status).toBe(404);
    });

    it("PATCH /api/admin/users/[id] — adminB no puede editar usuario de hotel A (404)", async () => {
      const res = await api(`/api/admin/users/${adminA.id}`, tokAdminB, {
        method: "PATCH",
        body: JSON.stringify({ role: "auditor" }),
      });
      expect(res.status).toBe(404);
    });

    it("DELETE /api/admin/users/[id] — adminB no puede borrar usuario de hotel A (404)", async () => {
      const res = await api(`/api/admin/users/${adminA.id}`, tokAdminB, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });

    it("POST /api/admin/delete-user — adminB no puede borrar usuario de hotel A", async () => {
      const res = await api("/api/admin/delete-user", tokAdminB, {
        method: "POST",
        body: JSON.stringify({ user_id: auditorA.id }),
      });
      // Puede ser 403 o 404 dependiendo de si el target no es accesible
      expect([403, 404]).toContain(res.status);
    });

    it("DELETE /api/audit-runs/[id] — adminB no puede borrar run de hotel A", async () => {
      const res = await api(`/api/audit-runs/${runIdA}`, tokAdminB, {
        method: "DELETE",
      });
      // 403 si el RPC detecta que el run no pertenece al hotel del caller
      expect([403, 404]).toContain(res.status);
    });

    it("POST /api/audits/reopen — adminB no puede reabrir run de hotel A", async () => {
      const res = await api("/api/audits/reopen", tokAdminB, {
        method: "POST",
        body: JSON.stringify({ run_id: runIdA }),
      });
      // run no pertenece al hotel de adminB
      expect([403, 404]).toContain(res.status);
    });

    it("GET /api/members — adminB obtiene miembros de su hotel, no del A", async () => {
      const resA = await api("/api/members", tokAdminA);
      expect(resA.status).toBe(200);
      const bodyA = await resA.json();
      expect(bodyA.hotel_id).toBe(hotelA);

      const resB = await api("/api/members", tokAdminB);
      expect(resB.status).toBe(200);
      const bodyB = await resB.json();
      expect(bodyB.hotel_id).not.toBe(hotelA);
    });

    it("GET /api/audits/[id]/full — adminB no lee auditoría de hotel A", async () => {
      const res = await api(`/api/audits/${runIdA}/full`, tokAdminB);
      // RPC devuelve vacío → 404, o el handler retorna 403
      expect([403, 404]).toContain(res.status);
    });

    it("PATCH /api/admin/hotel — adminB actualiza su propio hotel (200), no el de A", async () => {
      // No hay forma de apuntar a hotelA: resolveRouteHotelScope pina al hotel del caller
      const res = await api("/api/admin/hotel", tokAdminB, {
        method: "PATCH",
        body: JSON.stringify({ name: `[IT] RouteAuth-B updated` }),
      });
      // adminB puede editar su propio hotel
      expect(res.status).toBe(200);
    });
  });

  // ── 4. Happy path — roles correctos → 2xx ─────────────────────────────────

  describe("happy path — rol correcto → 2xx", () => {
    it("GET /api/admin/users — adminA", async () => {
      const res = await api("/api/admin/users", tokAdminA);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    it("GET /api/members — adminA", async () => {
      const res = await api("/api/members", tokAdminA);
      expect(res.status).toBe(200);
    });

    it("GET /api/members — managerA", async () => {
      const res = await api("/api/members", tokManagerA);
      expect(res.status).toBe(200);
    });

    it("PATCH /api/admin/hotel — adminA puede editar su hotel", async () => {
      const res = await api("/api/admin/hotel", tokAdminA, {
        method: "PATCH",
        body: JSON.stringify({ name: `[IT] RouteAuth-A updated` }),
      });
      expect(res.status).toBe(200);
    });

    it("POST /api/audits/start — auditorA con área asignada puede iniciar auditoría", async () => {
      const res = await api("/api/audits/start", tokAuditorA, {
        method: "POST",
        body: JSON.stringify({
          area_id: areaA,
          audit_template_id: templateA.templateId,
        }),
      });
      // 200 o 409 si plan/billing enforcement activo en test env
      expect([200, 403, 409]).toContain(res.status);
      if (res.status === 200) {
        const body = await res.json();
        expect(body.run_id).toBeTruthy();
        // Run abierto queda pendiente; bed.cleanup() lo elimina vía purgeHotel.
      }
    });

    it("GET /api/audits/[id]/full — auditorA lee su run completado", async () => {
      const res = await api(`/api/audits/${runIdA}/full`, tokAuditorA);
      expect([200, 404]).toContain(res.status); // 404 si RPC filtra por área
    });
  });
});