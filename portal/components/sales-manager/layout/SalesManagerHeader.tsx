"use client";
import BaseHeader, { PageTitleRule } from "@/components/layout/BaseHeader";

const titleRules: PageTitleRule[] = [
  { match: "/sales-manager", title: "Sales Overview", exact: true },
  { match: "/sales-manager/reports", title: "Sales Analytics" },
  { match: "/sales-team", title: "Team Management" },
  { match: "/sales-targets", title: "Targets & Goals" },
  { match: "/leads", title: "Lead Pipeline" },
  { match: "/visits", title: "Visits" },
  { match: "/sales-orders", title: "Sales Orders" },
  { match: "/customers", title: "Customers" },
  { match: "/order-history", title: "Order History", exact: true },
  { match: "/stock-requests", title: "Stock Requests" },
  { match: "/backordered", title: "Backordered Items" },
  { match: "/distributors", title: "Distributors" },
  { match: "/attendance", title: "Attendance" },
];

export default function SalesManagerHeader({ handleDrawerToggle }: { handleDrawerToggle: () => void }) {
  return <BaseHeader handleDrawerToggle={handleDrawerToggle} titleRules={titleRules} fallbackTitle="Sales Portal" breadcrumbPrefix="Sales" />;
}
