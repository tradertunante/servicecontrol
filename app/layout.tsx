// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import QueryProvider from "./providers/QueryProvider";
import AuthSessionSync from "./components/AuthSessionSync";
import ToastProvider from "./providers/ToastProvider";
import PostHogProvider from "./providers/PostHogProvider";

export const metadata: Metadata = {
  title: "ServiceControl",
  description: "Control operativo y calidad hotelera en una sola plataforma.",
  metadataBase: new URL("https://servicecontrol.com"),
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
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
