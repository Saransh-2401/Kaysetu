import { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "All 11 ERP + CRM Modules, Explored | KaySetu" },
  description:
    "Explore every KaySetu module: agent tracking, field sales, orders, distribution, inventory, production, procurement and GST accounts, and see how one platform runs the whole flow.",
  keywords: [
    "ERP software demo",
    "ERP CRM modules",
    "ERP module features",
    "unified ERP CRM platform",
    "ERP software tour India",
  ],
  alternates: { canonical: "/modules" },
  openGraph: {
    title: "All 11 ERP + CRM Modules, Explored | KaySetu",
    description:
      "Explore every KaySetu module and see how one platform runs field sales, stock, production and accounts in a single live flow.",
    type: "website",
    images: ["/opengraph-image"],
    url: "/modules",
    siteName: "KaySetu",
    locale: "en_IN",
  },
};

export default function ModulesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>;
}
