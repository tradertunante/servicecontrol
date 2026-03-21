"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/providers/ToastProvider";

import BackButton from "@/app/components/BackButton";
import { supabase } from "@/lib/supabaseClient";
import type { Profile, Role } from "@/lib/types";

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  active: boolean;
};

export default function UsersPageClient({
  initialProfile,
  hotelId,
}: {
  initialProfile: Profile;
  hotelId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesion invalida.");

      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "No se pudieron cargar los usuarios.");
      setUsers((payload?.users ?? []) as UserRow[]);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function deleteUser(userId: string) {
    const target = users.find((user) => user.id === userId);
    const name = target?.full_name || target?.email || userId.slice(0, 8);

    if (userId === initialProfile.id) {
      toast.error("No puedes borrarte a ti mismo.");
      return;
    }

    if (!confirm(`Vas a borrar permanentemente a: ${name}\n\n¿Quieres continuar?`)) return;
    const typed = prompt("Para confirmar, escribe BORRAR");
    if ((typed ?? "").trim().toUpperCase() !== "BORRAR") {
      toast.warn("Cancelado.");
      return;
    }

    try {
      setBusyId(userId);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesion invalida.");

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const text = await res.text();
      let payload: any = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text?.slice(0, 200) || "Respuesta no-JSON." };
      }
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo borrar.");
      await load();
    } catch (e: any) {
      toast.error(`Error borrando: ${e?.message ?? "desconocido"}`);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <main className="p-6">
        <BackButton fallback="/" />
        <h1 className="text-[56px] mb-1.5">Usuarios</h1>
        <div className="opacity-80">Cargando...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6">
        <BackButton fallback="/" />
        <h1 className="text-[56px] mb-1.5">Usuarios</h1>
        <div className="text-[crimson] font-[950]">{error}</div>
      </main>
    );
  }

  return (
    <main className="p-6">
      <BackButton fallback="/" />
      <div className="flex justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[56px] mb-1.5">Usuarios</h1>
          <div className="opacity-80">
            {initialProfile.role} · Hotel: <span className="font-mono">{hotelId}</span>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <button
            className="px-4 py-3 rounded-xl border border-black/20 bg-black text-white font-[950] cursor-pointer h-11"
            onClick={() => router.push("/users/new")}
          >
            + Crear usuario
          </button>
          <button
            className="px-4 py-3 rounded-xl border border-black/20 bg-white text-black font-[950] cursor-pointer h-11"
            onClick={() => router.push("/")}
          >
            Volver
          </button>
        </div>
      </div>
      <div className="mt-[18px] rounded-[18px] border border-black/[0.08] bg-white/75 overflow-hidden">
        <div className="grid [grid-template-columns:2fr_2fr_1fr_1fr_220px] items-center">
          <div className="font-[950] px-4 py-[14px] border-b border-black/[0.06] bg-white/85">Nombre</div>
          <div className="font-[950] px-4 py-[14px] border-b border-black/[0.06] bg-white/85">Email</div>
          <div className="font-[950] px-4 py-[14px] border-b border-black/[0.06] bg-white/85">Rol</div>
          <div className="font-[950] px-4 py-[14px] border-b border-black/[0.06] bg-white/85">Estado</div>
          <div className="font-[950] px-4 py-[14px] border-b border-black/[0.06] bg-white/85"></div>
          {users.map((user) => (
            <div key={user.id} className="contents">
              <div className="px-4 py-[14px] border-b border-black/[0.05] align-middle">
                <div className="font-[950]">
                  {user.full_name?.trim() ? user.full_name : "—"}
                  <span className="ml-2.5 opacity-55 text-[13px]">{user.id.slice(0, 8)}…</span>
                </div>
              </div>
              <div className="px-4 py-[14px] border-b border-black/[0.05] align-middle">
                <div className="opacity-90 font-[800]">{user.email ?? "—"}</div>
              </div>
              <div className="px-4 py-[14px] border-b border-black/[0.05] align-middle">
                <div className="font-[900]">{user.role}</div>
              </div>
              <div className="px-4 py-[14px] border-b border-black/[0.05] align-middle">
                <div className="font-[900]">{user.active ? "Activo" : "Inactivo"}</div>
              </div>
              <div className="px-4 py-[14px] border-b border-black/[0.05] align-middle flex justify-end gap-2.5 flex-wrap">
                <button
                  className="px-[14px] py-2.5 rounded-xl border border-black/35 bg-white font-[950] cursor-pointer h-[42px]"
                  onClick={() => router.push(`/users/${user.id}`)}
                >
                  Editar
                </button>
                <button
                  className="px-[14px] py-2.5 rounded-xl border border-[rgba(220,20,60,0.55)] bg-[rgba(220,20,60,0.08)] text-[crimson] font-[950] cursor-pointer h-[42px]"
                  style={{
                    opacity: busyId === user.id ? 0.6 : 1,
                    cursor: busyId ? "not-allowed" : "pointer",
                  }}
                  disabled={!!busyId}
                  onClick={() => deleteUser(user.id)}
                >
                  {busyId === user.id ? "Borrando..." : "Borrar"}
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 ? (
            <div className="p-4 opacity-80 [grid-column:1_/_-1]">No hay usuarios para mostrar.</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
