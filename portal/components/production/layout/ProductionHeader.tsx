"use client";
import BaseHeader, { PageTitleRule } from "@/components/layout/BaseHeader";

const titleRules: PageTitleRule[] = [
  { match: "/production", title: "Production Overview", exact: true },
  { match: "/production/reports", title: "Production Analytics" },
  { match: "/production-planning/create", title: "Create Plan" },
  { match: "/production-planning", title: "Production Planning" },
  { match: "/work-orders", title: "Work Orders (WO)" },
  { match: "/job-cards", title: "Job Cards" },
  { match: "/bom", title: "Bill of Materials" },
  { match: "/material-requests", title: "Material Requests" },
  { match: "/backordered", title: "Backordered Items" },
];

export default function ProductionHeader({ handleDrawerToggle }: { handleDrawerToggle: () => void }) {
  return <BaseHeader handleDrawerToggle={handleDrawerToggle} titleRules={titleRules} fallbackTitle="Production Portal" breadcrumbPrefix="Production" />;
}
