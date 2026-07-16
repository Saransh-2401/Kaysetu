"use client";
import CategoryIcon from "@mui/icons-material/Category";
import GroupsIcon from "@mui/icons-material/Groups";
import HomeIcon from "@mui/icons-material/Home";
import MapIcon from "@mui/icons-material/Map";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import { useEffect, useState } from "react";

import AuthGuard from "@/components/AuthGuard";
import DashboardShell, { type NavItem } from "@/components/DashboardShell";
import { getContext, type PortalContext } from "@/lib/api";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<PortalContext | null>(null);

  useEffect(() => {
    setContext(getContext<PortalContext>("portal"));
  }, []);

  const labels = context?.org.labels ?? {};
  const modules = context?.org.modules ?? [];

  // Foundation items always; module items appear only if entitled (module store
  // upsell page arrives with the billing phase).
  const nav: NavItem[] = [
    { label: "Dashboard", href: "/portal", icon: <HomeIcon />, testId: "portal-nav-dashboard-link" },
    { label: labels.catalog ?? "Catalog", href: "/portal/catalog", icon: <CategoryIcon />, testId: "portal-nav-catalog-link" },
    { label: "Team", href: "/portal/team", icon: <GroupsIcon />, testId: "portal-nav-team-link" },
    ...(modules.includes("TRACK")
      ? [{ label: "Live Tracking", href: "/portal/tracking", icon: <MapIcon />, testId: "portal-nav-tracking-link" }]
      : []),
    ...(modules.includes("FIELD")
      ? [{ label: "Field Sales", href: "/portal/field", icon: <PointOfSaleIcon />, testId: "portal-nav-field-link" }]
      : []),
  ];

  return (
    <AuthGuard scope="portal">
      <DashboardShell scope="portal" title={context?.org.name ?? "Portal"}
        subtitle={context?.org.org_code} nav={nav}>
        {children}
      </DashboardShell>
    </AuthGuard>
  );
}
