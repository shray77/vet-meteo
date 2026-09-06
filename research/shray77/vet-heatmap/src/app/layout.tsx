import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryClientProvider } from "@/lib/query-client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
  preload: false,
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
  preload: false,
  display: "swap",
});

const siteUrl = "https://shray77.github.io/vet-heatmap";
const basePath = "/vet-heatmap";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ВетКарта — эпизоотическая обстановка России",
    template: "%s · ВетКарта",
  },
  description:
    "Профессиональный инструмент для ветеринарных специалистов: интерактивная карта вспышек болезней животных, зоны риска по стандартам ВОЗЖ, калькулятор карантина, эпидкривые. Работает офлайн (PWA).",
  keywords: [
    "ветеринария", "эпизоотология", "АЧС", "ящур", "бешенство", "грипп птиц",
    "сибирская язва", "WOAH", "ВОЗЖ", "Россельхознадзор", "карантин",
    "ветеринарная карта", "эпизоотическая ситуация", "РФ",
  ],
  authors: [{ name: "vet-heatmap contributors" }],
  applicationName: "ВетКарта",
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${basePath}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${basePath}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: `${basePath}/icons/icon-192.png`,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ВетКарта",
  },
  openGraph: {
    title: "ВетКарта — эпизоотическая обстановка России",
    description:
      "Профессиональный ветеринарный инструмент: карта вспышек болезней животных, зоны риска, калькулятор карантина.",
    url: siteUrl,
    siteName: "ВетКарта",
    type: "website",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: "ВетКарта",
    description: "Эпизоотическая обстановка России — карта вспышек болезней животных",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1B5E20" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1419" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // allow zoom for accessibility
  viewportFit: "cover", // respect safe areas
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground overscroll-none`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryClientProvider>
            {children}
            <Toaster />
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
