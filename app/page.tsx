// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "admin" | "manager" | "auditor" | "superadmin";

type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  hotel_id: string | null;
  active?: boolean | null;
};

function cleanRole(input: any): Role {
  const r = String(input ?? "")
    .trim()
    .toLowerCase();

  if (r === "superadmin") return "superadmin";
  if (r === "admin") return "admin";
  if (r === "manager") return "manager";
  if (r === "auditor") return "auditor";

  // Si llega algo raro, por defecto NO lo conviertas a admin; mejor auditor (o login)
  return "auditor";
}

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
        // 1) Espera corta a que la sesión esté lista (Safari / App Router)
        const start = Date.now();
        let session = null as any;

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

        // 2) Carga usuario y profile
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

        const role = cleanRole(prof.role);

        const profile: Profile = {
          id: prof.id,
          full_name: prof.full_name ?? null,
          role,
          hotel_id: prof.hotel_id ?? null,
          active: prof.active ?? null,
        };

        // DEBUG visible (para que veas qué rol está leyendo)
        setDebug(`uid=${uid} role_raw=${String(prof.role)} role_clean=${role}`);

        // 3) Redirección por rol
        if (profile.role === "superadmin") {
          router.replace("/superadmin");
          return;
        }

        if (profile.role === "auditor") {
          router.replace("/audits");
          return;
        }

        router.replace("/dashboard");
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

  // Si no hay error, esto se verá un instante (hasta que router.replace actúe)
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