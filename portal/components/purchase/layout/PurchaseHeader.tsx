"use client";
import BaseHeader, { PageTitleRule } from "@/components/layout/BaseHeader";

const titleRules: PageTitleRule[] = [
  { match: "/purchase", title: "Procurement Overview", exact: true },
  { match: "/material-requests", title: "Material Requests" },
  { match: "/purchase-orders", title: "Purchase Orders" },
  { match: "/suppliers", title: "Supplier Directory" },
  { match: "/reports", title: "Purchase Analytics" },
];

export default function PurchaseHeader({ handleDrawerToggle }: { handleDrawerToggle: () => void }) {
  return <BaseHeader handleDrawerToggle={handleDrawerToggle} titleRules={titleRules} fallbackTitle="Purchase Portal" breadcrumbPrefix="Purchase" />;
}
