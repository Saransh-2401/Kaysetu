import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import ClientThemeWrapper from "@/components/ClientThemeWrapper";
import AuthGuard from "@/components/auth/AuthGuard";
import AppShell from "@/components/layout/AppShell";
import {
  SCHEME_COOKIE,
  SCHEME_CUSTOM_COOKIE,
  CUSTOM_SCHEME_KEY,
  resolveScheme,
  CustomSchemeInput,
} from "@/theme/schemes";
import { schemeToVars } from "@/theme/cssVars";
import { getFont, FONT_COOKIE } from "@/theme/fonts";
import "./globals.css";



export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://salexa.kayease.com"
  ),
  title: {
    template: "%s | Salexa CRM",
    default: "Salexa - Premium Enterprise CRM Solution",
  },
  description:
    "Salexa is a next-generation Enterprise Resource Planning (ERP) and Customer Relationship Management (CRM) platform designed for modern businesses.",
  manifest: "/favicon/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [
      {
        url: "/favicon/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    other: [
      {
        rel: "icon",
        url: "/favicon/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        rel: "icon",
        url: "/favicon/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
  authors: [{ name: "Kayease Team", url: "https://kayease.com" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://salexa.kayease.com",
    title: "Salexa - Premium Enterprise CRM Solution",
    description:
      "Boost your sales team productivity with Salexa - The all-in-one CRM & ERP platform.",
    siteName: "Salexa",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Salexa CRM Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Salexa - Premium Enterprise CRM",
    description: "Manage sales, visits, and leads efficiently with Salexa.",
    creator: "@kayease",
    images: ["/og-image.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2C3E50" },
    { media: "(prefers-color-scheme: dark)", color: "#1a252f" },
  ],
};

import { Toaster } from "@/components/ui/sonner";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the persisted global scheme from the cookie so first paint matches it
  // (zero flash). ClientThemeWrapper then reconciles with the backend value.
  const cookieStore = await cookies();
  const schemeKey = cookieStore.get(SCHEME_COOKIE)?.value;
  let customInput: CustomSchemeInput | null = null;
  if (schemeKey === CUSTOM_SCHEME_KEY) {
    const raw = cookieStore.get(SCHEME_CUSTOM_COOKIE)?.value;
    if (raw) {
      try {
        customInput = JSON.parse(decodeURIComponent(raw)) as CustomSchemeInput;
      } catch {
        customInput = null;
      }
    }
  }
  const scheme = resolveScheme(schemeKey, customInput);
  const font = getFont(cookieStore.get(FONT_COOKIE)?.value);
  const initialVars = {
    ...schemeToVars(scheme, "light"),
    "--app-font": font.family,
  } as React.CSSProperties;

  return (
    <html lang="en" data-scheme={scheme.key} data-font={font.key} style={initialVars}>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <ClientThemeWrapper initialScheme={scheme.key} initialCustom={customInput} initialFont={font.key}>
            <AuthGuard>
              <AppShell>
                {children}
              </AppShell>
            </AuthGuard>
            <Toaster position="top-right" richColors />
          </ClientThemeWrapper>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
