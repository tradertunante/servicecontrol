// FILE: app/superadmin/memberships/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJsonOrThrow } from "@/lib/superadmin/clientApi";
import { MEMBERSHIP_ROLES } from "@/lib/auth/hotelMemberships";

type Hotel = { id: string; name: string };

type Membership = {
  hotel_id: string;
  hotel_name: string;
  role: string;
  active: boolean;
};

type UserInfo = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  hotel_id: string | null;
};

export default function SuperadminMembershipsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<UserInfo | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [newHotelId, setNewHotelId] = useState("");
  const [newRole, setNewRole] = useState<string>(MEMBERSHIP_ROLES[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchJsonOrThrow<{ hotels: Hotel[] }>("/api/superadmin/hotels", { method: "GET" })
      .then((result) => setHotels(result.hotels ?? []))
      .catch(() => setError("No se pudieron cargar los hoteles."));
  }, []);

  const loadUser = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      const result = await fetchJsonOrThrow<{ user: UserInfo; memberships: Membership[] }>(
        `/api/superadmin/memberships?email=${encodeURIComponent(value)}`,
        { method: "GET" }
      );
      setUser(result.user);
      setMemberships(result.memberships);
    } catch (e: unknown) {
      setUser(null);
      setMemberships([]);
      setError(e instanceof Error ? e.message : "No se pudo cargar el usuario.");
    } finally {
      setBusy(false);
    }
  };

  const reload = async () => {
    if (!user) return;
    const result = await fetchJsonOrThrow<{ user: UserInfo; memberships: Membership[] }>(
      `/api/superadmin/memberships?user_id=${user.id}`,
      { method: "GET" }
    );
    setUser(result.user);
    setMemberships(result.memberships);
  };

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "La operación falló.");
    } finally {
      setBusy(false);
    }
  };

  const addMembership = () => {
    if (!user || !newHotelId) return;
    void run(() =>
      fetchJsonOrThrow("/api/superadmin/memberships", {
        method: "POST",
        body: JSON.stringify({ user_id: user.id, hotel_id: newHotelId, role: newRole }),
      })
    );
  };

  const updateMembership = (hotelId: string, patch: { role?: string; active?: boolean }) => {
    if (!user) return;
    void run(() =>
      fetchJsonOrThrow("/api/superadmin/memberships", {
        method: "PATCH",
        body: JSON.stringify({ user_id: user.id, hotel_id: hotelId, ...patch }),
      })
    );
  };

  const removeMembership = (hotelId: string) => {
    if (!user) return;
    if (!window.confirm("¿Quitar el acceso de este usuario a ese hotel?")) return;
    void run(() =>
      fetchJsonOrThrow(`/api/superadmin/memberships?user_id=${user.id}&hotel_id=${hotelId}`, {
        method: "DELETE",
      })
    );
  };

  const availableToAdd = hotels.filter((h) => !memberships.some((m) => m.hotel_id === h.id));

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Accesos multi-hotel</h1>
        <p className="opacity-75 mt-2 text-sm">
          Asigna a un usuario los hoteles a los que puede acceder y su rol en cada uno.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/superadmin")}
          className="rounded-lg border border-black/20 bg-white px-4 py-2 text-sm font-semibold"
        >
          ← Volver a Superadmin
        </button>
      </header>

      <form onSubmit={loadUser} className="flex flex-wrap gap-2 items-end">
        <label className="flex flex-col text-sm gap-1">
          Email del usuario
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border rounded px-3 py-2 min-w-[260px]"
            placeholder="usuario@hotel.com"
          />
        </label>
        <button type="submit" disabled={busy || !email.trim()} className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-50">
          Buscar
        </button>
      </form>

      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}

      {user && (
        <section className="space-y-4">
          <div className="text-sm">
            <strong>{user.full_name || user.email}</strong>
            <span className="opacity-70"> · {user.email}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead>
                <tr className="text-left bg-slate-100">
                  <th className="px-3 py-2">Hotel</th>
                  <th className="px-3 py-2">Rol</th>
                  <th className="px-3 py-2">Activo</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {memberships.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 opacity-70">Sin hoteles asignados.</td>
                  </tr>
                )}
                {memberships.map((m) => (
                  <tr key={m.hotel_id} className="border-t">
                    <td className="px-3 py-2">
                      {m.hotel_name || m.hotel_id}
                      {user.hotel_id === m.hotel_id && <span className="ml-2 text-xs opacity-70">(activo)</span>}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Rol en ${m.hotel_name}`}
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => updateMembership(m.hotel_id, { role: e.target.value })}
                        className="border rounded px-2 py-1"
                      >
                        {MEMBERSHIP_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Activo en ${m.hotel_name}`}
                        checked={m.active}
                        disabled={busy}
                        onChange={(e) => updateMembership(m.hotel_id, { active: e.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeMembership(m.hotel_id)}
                        className="text-red-600 hover:underline disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex flex-col text-sm gap-1">
              Hotel
              <select
                value={newHotelId}
                onChange={(e) => setNewHotelId(e.target.value)}
                className="border rounded px-2 py-2 min-w-[220px]"
              >
                <option value="">Selecciona…</option>
                {availableToAdd.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm gap-1">
              Rol
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="border rounded px-2 py-2"
              >
                {MEMBERSHIP_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={addMembership}
              disabled={busy || !newHotelId}
              className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-50"
            >
              Añadir hotel
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
