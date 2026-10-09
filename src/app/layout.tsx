import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GROUND_DARK, GROUND_LIGHT } from "@/lib/brand/ground";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Lora is a variable font, so these three weights share one woff2: they cost
// no extra bytes. No italic: nothing sets Lora in italic yet.
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zenerate — AI Meditation Generator",
  description:
    "Create personalized meditation experiences with AI. Generate scripts, build your library, and discover community meditations.",

  // --- Install (task 24). The manifest is `manifest.ts`; iOS ignores most of
  // it and reads these instead. "default" keeps the page inside the safe area
  // under an opaque status bar, so no `viewport-fit=cover` or inset padding is
  // needed. "black-translucent" would put white status text over Paper in the
  // light theme.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zenerate",
  },
  icons: { apple: "/apple-touch-icon.png" },
  // --- end install
};

// The browser and status bar tint, following the system theme like the page
// does by default. A theme forced with the toggle is not reflected here.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: GROUND_DARK },
    { media: "(prefers-color-scheme: light)", color: GROUND_LIGHT },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable}`}
    >
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={300}>
            {children}
          </TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
