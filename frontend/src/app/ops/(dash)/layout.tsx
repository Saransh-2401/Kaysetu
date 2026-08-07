"use client";
import BusinessIcon from "@mui/icons-material/Business";
import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useEffect, useState } from "react";

import AuthGuard from "@/components/AuthGuard";
import DashboardShell, { type NavItem } from "@/components/DashboardShell";
import { api } from "@/lib/api";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  // Sidebar badges: the two queues an operator is accountable for. Both are
  // best-effort — a failed summary call must never block the console.
  const [ticketCount, setTicketCount] = useState(0);
  const [leadCount, setLeadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      api<Record<string, number>>("ops", "/sa/support/summary")
        .then((s) => !cancelled && setTicketCount(s.needs_attention ?? 0))
        .catch(() => {});
      api<Record<string, number>>("ops", "/sa/leads/summary")
        .then((s) => !cancelled && setLeadCount(s.needs_attention ?? 0))
        .catch(() => {});
    };
    pull();
    const timer = setInterval(pull, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const nav: NavItem[] = [
    {
      section: "Overview",
      label: "Command Center",
      href: "/ops",
      icon: <DashboardIcon />,
      testId: "ops-nav-commandcenter-link",
    },
    {
      section: "Customers",
      label: "Tenants",
      href: "/ops/tenants",
      icon: <BusinessIcon />,
      testId: "ops-nav-tenants-link",
    },
    {
      label: "Leads",
      href: "/ops/leads",
      icon: <TrendingUpIcon />,
      testId: "ops-nav-leads-link",
      badge: leadCount,
    },
    {
      label: "Tickets",
      href: "/ops/tickets",
      icon: <SupportAgentIcon />,
      testId: "ops-nav-tickets-link",
      badge: ticketCount,
    },
    {
      section: "Platform",
      label: "Provisioning",
      href: "/ops/provisioning",
      icon: <RocketLaunchIcon />,
      testId: "ops-nav-provisioning-link",
    },
    {
      label: "Packages",
      href: "/ops/packages",
      icon: <Inventory2Icon />,
      testId: "ops-nav-packages-link",
    },
    {
      label: "App Releases",
      href: "/ops/app-versions",
      icon: <SystemUpdateIcon />,
      testId: "ops-nav-app-versions-link",
    },
    // Platform-owned email/SMS: KaySetu's sending credentials + the template
    // wording every tenant receives (tenants can only view them).
    {
      label: "Messaging",
      href: "/ops/messaging",
      icon: <MarkEmailReadIcon />,
      testId: "ops-nav-messaging-link",
    },
  ];

  return (
    <AuthGuard scope="ops">
      <DashboardShell scope="ops" title="Ops Console" subtitle="SUPERADMIN" nav={nav}>
        {children}
      </DashboardShell>
    </AuthGuard>
  );
}
