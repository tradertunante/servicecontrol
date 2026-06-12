// app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import QueryProvider from "./providers/QueryProvider";

const inter = Inter({ subsets: ["latin"], display: "swap" });
import AuthSessionSync from "./components/AuthSessionSync";
import ToastProvider from "./providers/ToastProvider";
import PostHogProvider from "./providers/PostHogProvider";

export const metadata: Metadata = {
  title: "ServiceControl",
  description: "Control operativo y calidad hotelera en una sola plataforma.",
  metadataBase: new URL("https://servicecontrol.io"),
  openGraph: {
    title: "ServiceControl",
    description: "Control operativo y calidad hotelera en una sola plataforma.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ServiceControl",
    description: "Control operativo y calidad hotelera en una sola plataforma.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.className}>
      <body>
        <PostHogProvider>
          <QueryProvider>
            <AuthSessionSync />
            <ToastProvider>
              {children}
            </ToastProvider>
          </QueryProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
