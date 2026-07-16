"use client";
import BaseHeader, { PageTitleRule } from "@/components/layout/BaseHeader";

const titleRules: PageTitleRule[] = [
  { match: "/warehouse", title: "Warehouse Overview", exact: true },
  { match: "/warehouse/raw-materials", title: "Raw Materials" },
  { match: "/warehouse/our-products", title: "Our Products" },
  { match: "/warehouse/reports", title: "Stock Reports" },
  { match: "/stock-entries", title: "Stock Operations" },
  { match: "/stock-adjustments", title: "Stock Adjustments" },
  { match: "/stock-ledger", title: "Stock Ledger" },
  { match: "/stock-requests", title: "Stock Requests" },
  { match: "/backordered", title: "Backordered Items" },
  { match: "/purchase-orders", title: "Purchase Orders" },
];

export default function WarehouseHeader({ handleDrawerToggle }: { handleDrawerToggle: () => void }) {
  return <BaseHeader handleDrawerToggle={handleDrawerToggle} titleRules={titleRules} fallbackTitle="Warehouse Portal" breadcrumbPrefix="Operations" />;
}
