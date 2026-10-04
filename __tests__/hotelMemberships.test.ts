import { describe, it, expect } from "vitest";
import { normalizeMembershipRole, sortAvailableHotels } from "@/lib/auth/hotelMemberships";

describe("normalizeMembershipRole", () => {
  it("acepta roles asignables sin importar mayúsculas o espacios", () => {
    expect(normalizeMembershipRole(" Admin ")).toBe("admin");
    expect(normalizeMembershipRole("general_manager")).toBe("general_manager");
  });

  it("rechaza superadmin y valores desconocidos", () => {
    expect(normalizeMembershipRole("superadmin")).toBeNull();
    expect(normalizeMembershipRole("root")).toBeNull();
    expect(normalizeMembershipRole("")).toBeNull();
    expect(normalizeMembershipRole(undefined)).toBeNull();
  });
});

describe("sortAvailableHotels", () => {
  const hotels = [
    { id: "b", name: "Beta", role: "auditor" },
    { id: "a", name: "Alfa", role: "admin" },
    { id: "c", name: "Gamma", role: "manager" },
  ];

  it("pone primero el hotel activo y ordena el resto por nombre", () => {
    expect(sortAvailableHotels(hotels, "c").map((h) => h.id)).toEqual(["c", "a", "b"]);
  });

  it("ordena por nombre si no hay hotel activo", () => {
    expect(sortAvailableHotels(hotels, null).map((h) => h.id)).toEqual(["a", "b", "c"]);
  });

  it("no muta el array original", () => {
    const copy = [...hotels];
    sortAvailableHotels(hotels, "c");
    expect(hotels).toEqual(copy);
  });
});
