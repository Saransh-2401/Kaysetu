"use client";
import CategoryIcon from "@mui/icons-material/Category";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import GroupsIcon from "@mui/icons-material/Groups";
import HomeIcon from "@mui/icons-material/Home";
import MapIcon from "@mui/icons-material/Map";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import SettingsIcon from "@mui/icons-material/Settings";
import { ThemeProvider } from "@mui/material/styles";
import { useCallback, useEffect, useMemo, useState } from "react";

import AuthGuard from "@/components/AuthGuard";
import DashboardShell, { type NavItem } from "@/components/DashboardShell";
import { CONTEXT_UPDATED_EVENT, getContext, type PortalContext } from "@/lib/api";
import { getScheme } from "@/schemes";
import { buildTheme } from "@/theme";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<PortalContext | null>(null);

  const refresh = useCallback(() => {
    setContext(getContext<PortalContext>("portal"));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(CONTEXT_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CONTEXT_UPDATED_EVENT, refresh);
  }, [refresh]);

  const labels = context?.org.labels ?? {};
  const modules = context?.org.modules ?? [];

  // The tenant's Appearance pick themes the whole portal.
  const tenantTheme = useMemo(
    () => buildTheme(getScheme(context?.org.appearance?.scheme)),
    [context?.org.appearance?.scheme],
  );

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
    { label: "Billing", href: "/portal/billing", icon: <CreditCardIcon />, testId: "portal-nav-billing-link" },
    { label: "Settings", href: "/portal/settings", icon: <SettingsIcon />, testId: "portal-nav-settings-link" },
  ];

  return (
    <AuthGuard scope="portal">
      <ThemeProvider theme={tenantTheme}>
        <DashboardShell scope="portal" title={context?.org.name ?? "Portal"}
          subtitle={context?.org.org_code} nav={nav}>
          {children}
        </DashboardShell>
      </ThemeProvider>
    </AuthGuard>
  );
}
