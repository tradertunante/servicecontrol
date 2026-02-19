// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={inter.className}>{children}</body>
    </html>
  );
}
