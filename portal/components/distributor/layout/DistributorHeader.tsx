"use client";
import BaseHeader, { PageTitleRule } from "@/components/layout/BaseHeader";

const titleRules: PageTitleRule[] = [
  { match: "/distributor", title: "Partner Dashboard", exact: true },
  { match: "/distributor-invoices", title: "Invoices & Billing" },
  { match: "/distributor-products", title: "Product Catalog" },
  { match: "/distributor/payments/new", title: "Make Payment" },
  { match: "/distributor/payments/history", title: "Payment History" },
  { match: "/distributor/requests", title: "My Requests" },
  { match: "/sales-orders", title: "New Order" },
  { match: "/order-history", title: "Order History", exact: true },
  { match: "/stock-requests", title: "Stock Requests" },
  { match: "/backordered", title: "Backordered Items" },
];

export default function DistributorHeader({ handleDrawerToggle }: { handleDrawerToggle: () => void }) {
  return <BaseHeader handleDrawerToggle={handleDrawerToggle} titleRules={titleRules} fallbackTitle="Distributor Portal" breadcrumbPrefix="Partner" />;
}
