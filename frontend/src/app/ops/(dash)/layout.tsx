"use client";
import BusinessIcon from "@mui/icons-material/Business";
import DashboardIcon from "@mui/icons-material/Dashboard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import AuthGuard from "@/components/AuthGuard";
import DashboardShell, { type NavItem } from "@/components/DashboardShell";

const NAV: NavItem[] = [
  { label: "Command Center", href: "/ops", icon: <DashboardIcon />, testId: "ops-nav-commandcenter-link" },
  { label: "Tenants", href: "/ops/tenants", icon: <BusinessIcon />, testId: "ops-nav-tenants-link" },
  { label: "Leads", href: "/ops/leads", icon: <TrendingUpIcon />, testId: "ops-nav-leads-link" },
  { label: "Tickets", href: "/ops/tickets", icon: <SupportAgentIcon />, testId: "ops-nav-tickets-link" },
  { label: "Provisioning", href: "/ops/provisioning", icon: <RocketLaunchIcon />, testId: "ops-nav-provisioning-link" },
  { label: "Packages", href: "/ops/packages", icon: <Inventory2Icon />, testId: "ops-nav-packages-link" },
  { label: "App Releases", href: "/ops/app-versions", icon: <SystemUpdateIcon />, testId: "ops-nav-app-versions-link" },
];

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard scope="ops">
      <DashboardShell scope="ops" title="Ops Console" subtitle="SuperAdmin" nav={NAV}>
        {children}
      </DashboardShell>
    </AuthGuard>
  );
}
