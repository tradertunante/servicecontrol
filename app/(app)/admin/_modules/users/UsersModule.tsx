"use client";

import { useRouter } from "next/navigation";

export default function UsersModule() {
  const router = useRouter();

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 18,
        background: "var(--card-bg)",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 900 }}>Usuarios</div>
      <div style={{ opacity: 0.82, lineHeight: 1.5 }}>
        La gestion de usuarios usa una sola superficie canonica en <b>/users</b>.
        Este panel ya no mantiene un sistema paralelo ni contratos API propios.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => router.push("/users")}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "#000",
            color: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Abrir gestion de usuarios
        </button>
      </div>
    </div>
  );
}
