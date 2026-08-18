import type { Metadata } from "next";
import LegalDoc from "@/components/LegalDoc";
import { legalPages } from "@/lib/content";

export const metadata: Metadata = {
  title: { absolute: "Privacy Policy | KaySetu by Kayease" },
  description:
    "How KaySetu (by Kayease) collects, uses and protects your information across the website and the ERP + CRM platform, and the choices and rights you have.",
  keywords: [
    "KaySetu privacy policy",
    "Kayease privacy",
    "ERP CRM data privacy",
    "data protection India",
  ],
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Privacy Policy | KaySetu by Kayease",
    description:
      "How KaySetu collects, uses and protects your information, and the choices you have.",
    type: "website",
    images: ["/opengraph-image"],
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return <LegalDoc doc={legalPages.privacy} />;
}
