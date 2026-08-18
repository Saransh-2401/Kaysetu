import type { Metadata } from "next";
import LegalDoc from "@/components/LegalDoc";
import { legalPages } from "@/lib/content";

export const metadata: Metadata = {
  title: { absolute: "Terms of Service | KaySetu by Kayease" },
  description:
    "The terms governing your use of the KaySetu website and ERP + CRM platform by Kayease: intellectual property, disclaimers and limitation of liability.",
  keywords: [
    "KaySetu terms of service",
    "Kayease terms",
    "ERP CRM terms",
    "software terms India",
  ],
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Terms of Service | KaySetu by Kayease",
    description:
      "Terms governing your use of the KaySetu website and ERP + CRM platform.",
    type: "website",
    images: ["/opengraph-image"],
    url: "/terms",
  },
};

export default function TermsPage() {
  return <LegalDoc doc={legalPages.terms} />;
}
