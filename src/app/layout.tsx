import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { KeyboardChrome } from "@/components/layout/keyboard-chrome";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fa } from "@/lib/i18n/fa";
import "./globals.css";

const vazirmatn = localFont({
  src: "../../public/fonts/vazirmatn-variable.woff2",
  variable: "--font-vazirmatn",
  display: "swap",
  weight: "100 900",
  fallback: ["Tahoma", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: fa.appName,
    template: `%s | ${fa.appName}`,
  },
  description: fa.appTagline,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: fa.appName,
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#fb620e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${vazirmatn.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>
            {children}
            <KeyboardChrome />
            <Toaster richColors position="top-center" dir="rtl" />
            <PwaRegister />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
