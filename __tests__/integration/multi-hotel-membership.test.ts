/**
 * Flujo: usuario no superadmin con membresía en varios hoteles.
 *
 * Verifica la migración 20261004100000 (hotel_memberships como fuente de verdad):
 *  - Sin membresía en B, el usuario no ve datos de B.
 *  - Al activar B (perfil apunta a B con el rol de la membresía), ve B y deja de ver A.
 *  - Cambiar el rol de la membresía del hotel activo se refleja en profiles.role.
 *  - Desactivar la membresía del hotel activo lo mueve al siguiente hotel activo.
 *  - Un usuario no puede auto-asignarse un hotel sin membresía (trigger de escalada).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { integrationEnabled } from "./helpers/env";
import { TestBed, type TestUser } from "./helpers/factory";
import { signedInClient, type Db } from "./helpers/clients";

const suite = describe.skipIf(!integrationEnabled);

suite("Membresías multi-hotel para usuarios no superadmin", () => {
  let bed: TestBed;
  let hotelA: string;
  let hotelB: string;
  let hotelC: string;
  let areaA: string;
  let areaB: string;
  let user: TestUser;
  let db: Db;

  async function profileOf(userId: string) {
    const { data } = await bed.admin
      .from("profiles")
      .select("hotel_id, role")
      .eq("id", userId)
      .single();
    return data!;
  }

  async function visibleAreaIds(client: Db): Promise<string[]> {
    const { data } = await client.from("areas").select("id").in("id", [areaA, areaB]);
    return (data ?? []).map((r) => r.id);
  }

  beforeAll(async () => {
    bed = new TestBed();
    hotelA = await bed.createHotel("Multi A");
    hotelB = await bed.createHotel("Multi B");
    hotelC = await bed.createHotel("Multi C");
    areaA = await bed.createArea(hotelA, "Multi A - Recepción");
    areaB = await bed.createArea(hotelB, "Multi B - Recepción");
    user = await bed.createUser({ hotelId: hotelA, role: "admin" });
    db = await signedInClient(user.email, user.password);
  });

  afterAll(async () => {
    await db?.auth.signOut();
    await bed.admin.from("hotel_memberships").delete().eq("user_id", user.id);
    await bed.cleanup();
  });

  it("el alta crea la membresía del hotel de origen con su rol", async () => {
    const { data } = await bed.admin
      .from("hotel_memberships")
      .select("role, active")
      .eq("user_id", user.id)
      .eq("hotel_id", hotelA)
      .single();
    expect(data).toEqual({ role: "admin", active: true });
  });

  it("sin membresía en B no ve datos de B", async () => {
    expect(await visibleAreaIds(db)).toEqual([areaA]);
  });

  it("al añadir membresía en B (superadmin) no cambia el hotel activo", async () => {
    const { error } = await bed.admin
      .from("hotel_memberships")
      .insert({ user_id: user.id, hotel_id: hotelB, role: "auditor", active: true });
    expect(error).toBeNull();

    expect(await profileOf(user.id)).toEqual({ hotel_id: hotelA, role: "admin" });
    expect(await visibleAreaIds(db)).toEqual([areaA]);
  });

  it("al activar B el perfil toma B y el rol de esa membresía", async () => {
    const { error } = await bed.admin
      .from("profiles")
      .update({ hotel_id: hotelB, role: "auditor" })
      .eq("id", user.id);
    expect(error).toBeNull();

    expect(await visibleAreaIds(db)).toEqual([areaB]);
  });

  it("cambiar el rol de la membresía activa sincroniza profiles.role", async () => {
    const { error } = await bed.admin
      .from("hotel_memberships")
      .update({ role: "manager" })
      .eq("user_id", user.id)
      .eq("hotel_id", hotelB);
    expect(error).toBeNull();

    expect(await profileOf(user.id)).toEqual({ hotel_id: hotelB, role: "manager" });
  });

  it("el listado de cada hotel muestra al usuario con su rol en ese hotel", async () => {
    const { data: listA } = await bed.admin.rpc("list_hotel_users_with_meta", { p_hotel_id: hotelA });
    const { data: listB } = await bed.admin.rpc("list_hotel_users_with_meta", { p_hotel_id: hotelB });

    const rowA = (listA ?? []).find((r) => r.id === user.id);
    const rowB = (listB ?? []).find((r) => r.id === user.id);
    expect(rowA?.role).toBe("admin");
    expect(rowB?.role).toBe("manager");
  });

  it("desactivar la membresía activa mueve el perfil a otro hotel activo y revoca B", async () => {
    const { error } = await bed.admin
      .from("hotel_memberships")
      .update({ active: false })
      .eq("user_id", user.id)
      .eq("hotel_id", hotelB);
    expect(error).toBeNull();

    expect(await profileOf(user.id)).toEqual({ hotel_id: hotelA, role: "admin" });
    expect(await visibleAreaIds(db)).toEqual([areaA]);
  });

  it("no permite activar un hotel sin membresía (auto-asignación)", async () => {
    const { error } = await db
      .from("profiles")
      .update({ hotel_id: hotelC, role: "admin" })
      .eq("id", user.id);

    // El trigger de escalada rechaza el cambio: el perfil no cambia.
    expect(error).not.toBeNull();
    expect(await profileOf(user.id)).toEqual({ hotel_id: hotelA, role: "admin" });
  });
});
