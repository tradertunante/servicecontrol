import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  email: string;
  password: string;
  role: "admin" | "manager" | "auditor";
  hotel_id: string; // uuid
  full_name?: string | null;
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client “as caller” (para validar quién llama)
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401 });
    }

    const body: Body = await req.json();

    // Lee profile del caller (RLS debe permitirlo)
    const { data: callerProfile, error: profErr } = await caller
      .from("profiles")
      .select("id, role, hotel_id, active")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profErr || !callerProfile) {
      return new Response(JSON.stringify({ error: "No se pudo leer tu perfil" }), { status: 403 });
    }
    if (callerProfile.active === false) {
      return new Response(JSON.stringify({ error: "Usuario inactivo" }), { status: 403 });
    }

    const isSuperadmin = callerProfile.role === "superadmin";
    const isHotelAdmin = callerProfile.role === "admin";

    // Permisos: superadmin puede crear en cualquier hotel, admin solo en su hotel
    if (!isSuperadmin && !isHotelAdmin) {
      return new Response(JSON.stringify({ error: "Sin permisos" }), { status: 403 });
    }
    if (!isSuperadmin && callerProfile.hotel_id !== body.hotel_id) {
      return new Response(JSON.stringify({ error: "No puedes crear usuarios fuera de tu hotel" }), { status: 403 });
    }
    if (body.role === "superadmin") {
      return new Response(JSON.stringify({ error: "No se puede crear superadmin aquí" }), { status: 400 });
    }

    // Admin client (service role) para crear Auth user
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    });

    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Error creando auth user" }), { status: 400 });
    }

    // Inserta profile
    const { error: insErr } = await admin.from("profiles").insert({
      id: created.user.id,
      email: body.email,
      role: body.role,
      hotel_id: body.hotel_id,
      active: true,
      full_name: body.full_name ?? null,
    });

    if (insErr) {
      // rollback best-effort
      await admin.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: `Error creando profile: ${insErr.message}` }), { status: 400 });
    }

    return new Response(JSON.stringify({ ok: true, user_id: created.user.id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});
