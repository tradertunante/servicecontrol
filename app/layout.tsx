// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import QueryProvider from "./providers/QueryProvider";
import AuthSessionSync from "./components/AuthSessionSync";

export const metadata: Metadata = {
  title: "ServiceControl",
  description: "Sistema de auditorías para hoteles",
  openGraph: {
    images: [{ url: "https://bolt.new/static/og_default.png" }],
  },
  twitter: {
    card: "summary_large_image",
    images: [{ url: "https://bolt.new/static/og_default.png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <QueryProvider>
          <AuthSessionSync />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
