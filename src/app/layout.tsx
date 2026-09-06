import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ВЕТРАДАР-61 — вет. эпид-риски Ростовской области",
  description: "Ветеринарный ГИС-прототип: гиперлокальный климат (Open-Meteo, METAR, MQTT-OSINT), THI КРС, BRD телят, клещи/КГЛ, фасциолёз, коридор АЧС. Ростовская область, горизонт 7 дней.",
  keywords: ["ветеринария", "ГИС", "THI", "АЧС", "КГЛ", "BRD", "Rostov", "эпидемиология", "Open-Meteo", "METAR", "OSINT"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
