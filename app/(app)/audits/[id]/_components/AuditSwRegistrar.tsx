"use client";

import { useEffect } from "react";

// Registers the audit Service Worker once per page load.
// Must be a client component; rendered inside the audit layout.
export function AuditSwRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }
  }, []);

  return null;
}