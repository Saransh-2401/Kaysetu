import { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Interactive ERP + CRM Walkthrough | KaySetu Modules" },
  description:
    "Walk through every KaySetu module: field sales, orders, inventory, production, procurement and GST accounts, and see how one platform runs the whole flow.",
  keywords: [
    "ERP software demo",
    "CRM walkthrough",
    "ERP module features",
    "unified ERP CRM platform",
    "ERP software tour India",
  ],
  alternates: { canonical: "/walkthrough" },
  openGraph: {
    title: "Interactive ERP + CRM Walkthrough | KaySetu Modules",
    description:
      "Walk through every KaySetu module and see how one platform runs field sales, stock, production and accounts in a single live flow.",
    type: "website",
    url: "/walkthrough",
    siteName: "KaySetu",
    locale: "en_IN",
  },
};

export default function WalkthroughLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>;
}
