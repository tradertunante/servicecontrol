// app/builder/page.tsx
"use client";

import HotelHeader from "@/app/components/HotelHeader";
import BuilderShell from "@/app/(app)/builder/_components/BuilderShell";

export default function BuilderPage() {
  return (
    <main style={{ padding: 24, paddingTop: 96 }}>
      <HotelHeader />
      <BuilderShell />
    </main>
  );
}