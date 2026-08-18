import type { Metadata } from "next";
import Script from "next/script";
import {
  Inter,
  JetBrains_Mono,
  Cormorant_Garamond,
  Plus_Jakarta_Sans,
  Playfair_Display,
  Fraunces,
} from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

// Section/step headings. Inter is the UI voice and Cormorant the editorial
// one; Jakarta sits between them — geometric and warmer than Inter, with
// enough character to carry a heading at semibold instead of needing 800.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const monoTech = JetBrains_Mono({
  variable: "--font-mono-tech",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kaysetu.kayease.com"),
  title: {
    default: "KaySetu: Your Business. Unified. | ERP + CRM by Kayease",
    template: "%s | KaySetu",
  },
  // Keep meta descriptions under ~160 chars — Google truncates past that and
  // rewrites the snippet itself, so the tail is wasted either way.
  description:
    "A unified ERP + CRM that runs sales, field ops, inventory, production, procurement and accounts in one real-time workflow. Web + mobile, GST-ready.",
  applicationName: "KaySetu",
  keywords: [
    "ERP CRM platform",
    "field sales app",
    "sales force automation",
    "distribution management software",
    "GST ERP",
    "KaySetu",
    "Kayease",
    "field sales CRM app",
    "distributor management system",
    "inventory management software India",
    "production ERP",
    "quote to cash software",
  ],
  authors: [{ name: "Kayease", url: "https://kaysetu.kayease.com" }],
  creator: "Kayease",
  publisher: "Kayease",
  // NOTE: deliberately no `alternates.canonical` here. Metadata is inherited,
  // so a canonical set on the root layout would stamp "/" onto every page that
  // doesn't override it — telling Google those pages are duplicates of the
  // homepage. Each route declares its own canonical instead.
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    title: "KaySetu: Your Business. Unified.",
    description:
      "A unified ERP + CRM platform: sales, field ops, inventory, production, procurement and accounts in one real-time workflow. Web + mobile, GST-ready.",
    type: "website",
    url: "https://kaysetu.kayease.com",
    siteName: "KaySetu",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "KaySetu: Your Business. Unified.",
    description:
      "A unified ERP + CRM platform: sales, field ops, inventory, production, procurement and accounts in one real-time workflow.",
  },
};

// GA4 is gated on the env var so dev/preview builds stay untracked: set
// NEXT_PUBLIC_GA_ID (a G-XXXXXXX measurement ID) in the production
// environment and analytics goes live with no code change.
const gaId = process.env.NEXT_PUBLIC_GA_ID;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://kaysetu.kayease.com/#organization",
      name: "Kayease",
      url: "https://kaysetu.kayease.com",
      description:
        "Kayease is a product studio building KaySetu, a unified ERP + CRM platform for fast-moving Indian SMEs.",
    },
    {
      "@type": "WebSite",
      "@id": "https://kaysetu.kayease.com/#website",
      url: "https://kaysetu.kayease.com",
      name: "KaySetu",
      publisher: { "@id": "https://kaysetu.kayease.com/#organization" },
      inLanguage: "en-IN",
    },
    {
      "@type": "SoftwareApplication",
      name: "KaySetu",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Android, iOS",
      description:
        "A next-generation ERP & CRM platform that unifies sales, field operations, inventory, production, procurement and accounts into one real-time, GST-ready workflow.",
      publisher: { "@id": "https://kaysetu.kayease.com/#organization" },
      offers: { "@type": "Offer", category: "SaaS" },
    },
  ],
};

import PageLoader from "@/components/PageLoader";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${monoTech.variable} ${playfair.variable} ${fraunces.variable} ${jakarta.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js');if(typeof sessionStorage!=='undefined'&&sessionStorage.getItem('kaysetu_loader_seen')){document.documentElement.classList.add('no-loader');}",
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <PageLoader />
        {children}
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
