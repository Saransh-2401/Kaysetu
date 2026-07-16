"use client";
import BaseHeader, { PageTitleRule } from "@/components/layout/BaseHeader";

const titleRules: PageTitleRule[] = [
  { match: "/sales-agent", title: "Dashboard", exact: true },
  { match: "/sales-agent/reports", title: "Performance" },
  { match: "/my-customers", title: "My Customers" },
  { match: "/visits", title: "Visits & Routes" },
  { match: "/my-orders", title: "Sales Orders" },
  { match: "/leads", title: "Leads" },
  { match: "/distributors", title: "Distributors" },
];

export default function SalesAgentHeader({ handleDrawerToggle }: { handleDrawerToggle: () => void }) {
  return <BaseHeader handleDrawerToggle={handleDrawerToggle} titleRules={titleRules} fallbackTitle="Sales Agent" breadcrumbPrefix="Field" />;
}
