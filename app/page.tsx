"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/auth/permissions";
import type { Profile } from "@/lib/types";
import { getDepartmentRedirectTarget } from "@/app/(app)/_lib/departmentAccess";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [debug, setDebug] = useState<string>("");

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setError("");
      setDebug("");

      try {
        const start = Date.now();
        let session: Awaited<
          ReturnType<typeof supabase.auth.getSession>
        >["data"]["session"] = null;

        while (Date.now() - start < 1500) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          session = data.session;
          if (session) break;
          await new Promise((r) => setTimeout(r, 120));
        }

        if (!alive) return;

        if (!session) {
          router.replace("/login");
          return;
        }

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!userData?.user) {
          router.replace("/login");
          return;
        }

        const uid = userData.user.id;

        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("id, full_name, role, hotel_id, active")
          .eq("id", uid)
          .maybeSingle();

        if (!alive) return;

        if (profErr) throw profErr;
        if (!prof) throw new Error(`No existe fila en profiles para uid=${uid}`);

        if (prof.active === false) {
          throw new Error("Tu usuario está inactivo.");
        }

        const role = normalizeRole(prof.role);

        const profile: Profile = {
          id: prof.id,
          full_name: prof.full_name ?? null,
          role,
          hotel_id: prof.hotel_id ?? null,
          active: prof.active ?? null,
        };

        setDebug(`uid=${uid} role_raw=${String(prof.role)} role_clean=${role}`);

        if (
          profile.role === "engineering" ||
          profile.role === "systems" ||
          profile.role === "it"
        ) {
          router.replace(getDepartmentRedirectTarget(profile.role, null));
          return;
        }

        router.replace("/home");
      } catch (e: any) {
        console.error("[HOME] Error real:", e);
        if (!alive) return;
        setError(e?.message ?? "Fallo al cargar la sesión/perfil.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>ServiceControl</h1>
        <p style={{ opacity: 0.7, marginTop: 8 }}>Cargando…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>ServiceControl</h1>
        <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>

        {!!debug && (
          <pre
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(0,0,0,0.05)",
              border: "1px solid rgba(0,0,0,0.12)",
              whiteSpace: "pre-wrap",
              fontWeight: 700,
            }}
          >
            {debug}
          </pre>
        )}

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          }}
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Volver a login
        </button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>ServiceControl</h1>
      <p style={{ opacity: 0.7, marginTop: 8 }}>Redirigiendo…</p>
      {!!debug && (
        <pre style={{ marginTop: 12, opacity: 0.8, fontWeight: 700, whiteSpace: "pre-wrap" }}>{debug}</pre>
      )}
    </main>
  );
}
