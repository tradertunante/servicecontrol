"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/my");
  }, [router]);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Redirigiendo…</h1>
      <p style={{ opacity: 0.7, marginTop: 10 }}>Te llevamos a tu espacio personal.</p>
    </main>
  );
}