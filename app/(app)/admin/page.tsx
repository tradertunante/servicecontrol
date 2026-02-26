"use client";

import HotelHeader from "@/app/components/HotelHeader";
import AdminShell from "@/app/(app)/admin/_components/AdminShell";

export default function AdminPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#eef1f5" }}>
      <HotelHeader />
      <div style={{ padding: 18 }}>
        <AdminShell />
      </div>
    </div>
  );
}